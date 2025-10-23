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

  external_id?: string;        // "order_<ObjectId>" (kita set di saat create)
  externalId?: string;
  externalID?: string;

  status?: string;             // PAID | SETTLED | EXPIRED | FAILED | PENDING
  invoice_status?: string;

  // kolom lain yang mungkin dikirim
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Validasi token callback
  const rawTokenHeader = req.headers["x-callback-token"];
  const tokenHeader = Array.isArray(rawTokenHeader) ? rawTokenHeader[0] : rawTokenHeader;
  if (!process.env.XENDIT_CALLBACK_TOKEN || tokenHeader !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(401).json({ message: "Invalid callback token" });
  }

  try {
    // ── Ambil payload dengan tipe aman ───────────────────────────────────────────
    const b = (req.body ?? {}) as XenditWebhookBody;

    const statusRaw = (b.status ?? b.invoice_status ?? "").toString();
    const externalRaw = (b.external_id ?? b.externalId ?? b.externalID ?? "").toString();
    const invoiceId = (b.id ?? b.invoice_id ?? b.invoiceId ?? "").toString();

    if (!statusRaw) {
      return res.status(400).json({ message: "Missing status" });
    }

    // ── Resolve Order dari payload ──────────────────────────────────────────────
    let order = null;

    // (1) external_id: "order_<ObjectId>"
    if (externalRaw && /^order_/.test(externalRaw)) {
      const maybeId = externalRaw.replace(/^order_/, "");
      if (mongoose.isValidObjectId(maybeId)) {
        order = await Order.findById(maybeId);
      }
    }

    // (2) fallback via invoice id yang kita simpan ke payment.providerRef
    if (!order && invoiceId) {
      order = await Order.findOne({ "payment.providerRef": invoiceId });
    }

    // (3) fallback opsional kalau kamu juga menyimpan externalId di payment
    if (!order && externalRaw) {
      order = await Order.findOne({ "payment.externalId": externalRaw });
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found for webhook payload" });
    }

    // Pastikan struktur payment ada
    order.payment = order.payment || { status: "PENDING" };

    // ── Update status ──────────────────────────────────────────────────────────
    const incoming = statusRaw.toUpperCase();
    const newStatus = STATUS_MAP[incoming] ?? "PENDING";
    const oldStatus = order.payment.status;

    if (invoiceId) order.payment.providerRef = invoiceId;
    order.payment.status = newStatus;
    await order.save();

    // ── Kirim WhatsApp (non-blocking) ──────────────────────────────────────────
    try {
      const phoneRaw = order.customer?.phone ?? "";
      const phone = normalizePhone(phoneRaw);
      const appName = process.env.APP_NAME || "MyApp";

      if (oldStatus !== newStatus && phone) {
        if (newStatus === "PAID") {
          const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
          const thankyou = `${base}/thankyou/${String(order._id)}`;

          // WaTpl.paid(appName, orderId, amount) -> 3 argumen
          const baseMsg = WaTpl.paid(appName, String(order._id), order.amounts?.total);
          const msg = `${baseMsg}\n\nLihat status & rincian pesanan: ${thankyou}`;

          await sendWhatsApp(phone, msg);
        } else if (newStatus === "FAILED" || newStatus === "CANCELLED") {
          const msg = WaTpl.failed(appName, String(order._id), incoming);
          await sendWhatsApp(phone, msg);
        }
      }
    } catch (waErr) {
      console.error("WA send error:", waErr);
      // jangan gagalkan webhook
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    // tangani unknown agar lulus no-explicit-any
    const message =
      typeof err === "object" && err !== null && "toString" in err
        ? (err as { toString: () => string }).toString()
        : "Webhook error";
    console.error("Webhook error:", message);
    return res.status(500).json({ message: "Webhook error" });
  }
}
