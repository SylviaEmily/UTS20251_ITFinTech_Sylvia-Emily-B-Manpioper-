// pages/api/webhooks/xendit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import mongoose from "mongoose";
import { sendWhatsApp } from "@/lib/wa";
import { WaTpl } from "@/lib/wa-templates";
import { normalizePhone } from "@/lib/phone";

/** Tipe payload Xendit (akomodasi variasi snake/camel case) */
interface XenditWebhookBody {
  id?: string;                 // invoice id
  invoice_id?: string;
  invoiceId?: string;

  external_id?: string;        // "order_<ObjectId>"
  externalId?: string;
  externalID?: string;

  status?: string;             // PAID | SETTLED | EXPIRED | FAILED | PENDING
  invoice_status?: string;

  [key: string]: unknown;
}

/** Map status Xendit -> internal */
const STATUS_MAP: Record<string, "PENDING" | "PAID" | "FAILED" | "CANCELLED"> = {
  PENDING: "PENDING",
  PAID: "PAID",
  SETTLED: "PAID",
  EXPIRED: "CANCELLED",
  FAILED: "FAILED",
};

/** Dokumen Mongoose minimal yang kita butuhkan */
type MDoc = {
  get(path: string): unknown;
  set(path: string, value: unknown): unknown;
  save(): Promise<unknown>;
};

function isMDoc(o: unknown): o is MDoc {
  if (!o || typeof o !== "object") return false;
  const r = o as Record<string, unknown>;
  return typeof r.get === "function" && typeof r.set === "function" && typeof r.save === "function";
}

/** Pastikan shape payment lengkap sesuai schema TS kamu */
function ensurePaymentShape(doc: MDoc): void {
  const p = doc.get("payment");
  if (!p || typeof p !== "object") {
    doc.set("payment", {
      method: "invoice",
      status: "PENDING",
      invoiceUrl: "",
      externalId: "",
      paidAt: null,
    });
    return;
  }
  const rec = p as Record<string, unknown>;
  if (typeof rec.method !== "string") doc.set("payment.method", "invoice");
  if (typeof rec.status !== "string") doc.set("payment.status", "PENDING");
  if (typeof rec.invoiceUrl !== "string") doc.set("payment.invoiceUrl", "");
  if (typeof rec.externalId !== "string") doc.set("payment.externalId", "");
}

/** Ambil total order secara aman */
function getOrderTotal(order: unknown): number | null {
  if (order && typeof order === "object") {
    const amounts = (order as Record<string, unknown>)["amounts"];
    if (amounts && typeof amounts === "object") {
      const total = (amounts as Record<string, unknown>)["total"];
      if (typeof total === "number") return Number.isFinite(total) ? total : null;
      if (typeof total === "string") {
        const n = Number(total);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Dukung preflight bila ada
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Validasi token callback lebih dulu (hindari koneksi DB jika token salah)
  const rawTokenHeader = req.headers["x-callback-token"];
  const tokenHeader = Array.isArray(rawTokenHeader) ? rawTokenHeader[0] : rawTokenHeader;
  if (!process.env.XENDIT_CALLBACK_TOKEN || tokenHeader !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(401).json({ message: "Invalid callback token" });
  }

  await dbConnect();

  try {
    // ── Ambil payload aman ─────────────────────────────────────────────────────
    const b = (req.body ?? {}) as XenditWebhookBody;

    const statusRaw = (b.status ?? b.invoice_status ?? "").toString();
    const externalRaw = (b.external_id ?? b.externalId ?? b.externalID ?? "").toString();
    const invoiceId = (b.id ?? b.invoice_id ?? b.invoiceId ?? "").toString();

    if (!statusRaw) {
      return res.status(400).json({ message: "Missing status" });
    }

        // ── Resolve Order ───────────────────────────────────────────────────────────
    // Simplify the order lookup section:
    let orderDoc = null;

    // Method 1: Find by external_id (most reliable)
    if (externalRaw) {
        const orderId = externalRaw.replace(/^order[-_]/, ''); // Handle both order_ and order-
        if (mongoose.isValidObjectId(orderId)) {
            orderDoc = await Order.findById(orderId);
        }
    }

    // Method 2: Fallback - find by invoice ID
    if (!orderDoc && invoiceId) {
        orderDoc = await Order.findOne({ "payment.providerRef": invoiceId });
    }

    if (!orderDoc) {
        console.error(`Order not found for external_id: ${externalRaw}, invoice_id: ${invoiceId}`);
        return res.status(404).json({ message: "Order not found" });
    }
    if (!isMDoc(orderDoc)) {
      return res.status(500).json({ message: "Unexpected order document shape" });
    }

    const order = orderDoc as MDoc;

    // Pastikan struktur payment lengkap
    ensurePaymentShape(order);

    // ── Update status ──────────────────────────────────────────────────────────
    const incoming = statusRaw.toUpperCase();
    const newStatus = STATUS_MAP[incoming] ?? "PENDING";

    const oldRaw = order.get("payment.status");
    const oldStatus =
      oldRaw === "PENDING" || oldRaw === "PAID" || oldRaw === "FAILED" || oldRaw === "CANCELLED"
        ? (oldRaw as "PENDING" | "PAID" | "FAILED" | "CANCELLED")
        : "PENDING";

    if (invoiceId) order.set("payment.providerRef", invoiceId);
    order.set("payment.status", newStatus);
    await order.save();

    // ── Kirim WhatsApp (non-blocking) ──────────────────────────────────────────
    try {
      const cust = order.get("customer") as Record<string, unknown> | null | undefined;
      const phoneRaw = cust && typeof cust === "object" ? (cust["phone"] as string | undefined) : "";
      const phone = normalizePhone(phoneRaw ?? "");
      const appName = process.env.APP_NAME || "MyApp";

      if (oldStatus !== newStatus && phone) {
        if (newStatus === "PAID") {
          // Base URL yang konsisten
          const base =
            (process.env.APP_BASE_URL ||
              process.env.APP_URL ||
              process.env.NEXT_PUBLIC_BASE_URL ||
              `https://${req.headers.host}`)!.replace(/\/+$/, "");
          // Samakan dengan flow create-invoice: /thank-you?order=<id>
          const thankyou = `${base}/thank-you?order=${String(order.get("_id"))}`;

          const total = getOrderTotal(order) ?? 0;
          const baseMsg = WaTpl.paid(appName, String(order.get("_id")), total);
          const msg = `${baseMsg}\n\nLihat status & rincian pesanan: ${thankyou}`;

          await sendWhatsApp(phone, msg);
        } else if (newStatus === "FAILED" || newStatus === "CANCELLED") {
          const msg = WaTpl.failed(appName, String(order.get("_id")), incoming);
          await sendWhatsApp(phone, msg);
        }
      }
    } catch (waErr) {
      console.error("WA send error:", waErr);
      // jangan gagalkan webhook
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook error";
    console.error("Webhook error:", message);
    return res.status(500).json({ message: "Webhook error" });
  }
}

