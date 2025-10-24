// pages/api/payments/xendit/create-invoice.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { dbConnect } from "@/lib/mongodb";
import Order from "@/models/Order";

// gunakan REST, biar tipenya gampang
type InvoiceReq = {
  external_id: string;
  amount: number;
  currency?: "IDR";
  description?: string;
  success_redirect_url?: string;
  failure_redirect_url?: string;
};

type InvoiceOk = { id: string; invoice_url: string };
type InvoiceErr = { message?: string; [k: string]: unknown };

type HasGetSet = {
  get?: (path: string) => unknown;
  set?: (path: string, value: unknown) => unknown;
};

function hasGetSet(o: unknown): o is Required<HasGetSet> {
  if (!o || typeof o !== "object") return false;
  const r = o as Record<string, unknown>;
  return typeof r.get === "function" && typeof r.set === "function";
}

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

/** Ambil nilai total dari order dengan aman */
function getOrderTotal(order: unknown): number | null {
  if (order && typeof order === "object") {
    const rec = order as Record<string, unknown>;
    const amounts = rec["amounts"];
    if (amounts && typeof amounts === "object") {
      const total = (amounts as Record<string, unknown>)["total"];
      if (typeof total === "number") return total;
      if (typeof total === "string") {
        const n = Number(total);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return null;
}

/** Pastikan object payment ada (tanpa pakai any) */
function ensurePaymentObject(doc: HasGetSet): void {
  const curr = doc.get?.("payment");
  if (!curr || typeof curr !== "object") {
    doc.set?.("payment", { status: "PENDING", method: "invoice" });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  try {
    const { orderId } = req.body as { orderId?: string };
    if (!orderId) return res.status(400).json({ message: "orderId required" });

    await dbConnect();

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // -- Guard amount --
    const total = getOrderTotal(order);
    if (!Number.isFinite(total)) {
      return res.status(400).json({ message: "Order total is missing or invalid" });
    }

    const payload: InvoiceReq = {
      external_id: `ORDER-${order._id}`,
      amount: total as number,
      currency: "IDR",
      description: `Payment for order ${order._id}`,
      success_redirect_url: `${getEnv("APP_URL")}/thankyou/${order._id}`,
      failure_redirect_url: `${getEnv("APP_URL")}/payment?failed=1`,
    };

    const r = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " + Buffer.from(String(getEnv("XENDIT_SECRET_KEY")) + ":").toString("base64"),
      },
      body: JSON.stringify(payload),
    });

    const raw: unknown = await r.json();

    if (!r.ok) {
      const ebody = raw as InvoiceErr | undefined;
      const msg = ebody?.message ?? `Failed to create invoice (HTTP ${r.status})`;
      return res.status(r.status).json({ message: msg });
    }

    // narrow respons Xendit
    const ok =
      typeof raw === "object" &&
      raw !== null &&
      "id" in raw &&
      "invoice_url" in raw &&
      typeof (raw as Record<string, unknown>).id === "string" &&
      typeof (raw as Record<string, unknown>).invoice_url === "string";

    if (!ok) return res.status(500).json({ message: "Unexpected response from Xendit" });

    const data = raw as InvoiceOk;

    // -- Update payment safely --
    if (!hasGetSet(order)) {
      return res.status(500).json({ message: "Order document shape unexpected" });
    }
    ensurePaymentObject(order);
    order.set("payment.provider", "xendit");
    order.set("payment.providerRef", data.id);
    order.set("payment.status", "PENDING");
    await order.save();

    return res.status(200).json({ invoiceId: data.id, invoiceUrl: data.invoice_url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error (unknown cause)";
    console.error("Create invoice error:", e);
    return res.status(500).json({ message: msg });
  }
}
