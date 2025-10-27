// pages/api/orders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import { Types } from "mongoose";

type Item = { productId: string; name: string; price: number; qty: number; imageUrl?: string };
type Payload = {
  customer: { name: string; phone: string; address: string; city: string; postalCode: string; email: string };
  items: Item[];
  amounts: { subtotal: number; tax: number; shipping: number; total: number; currency?: "IDR" };
  notes?: string;
};

type Ok = {
  success: true;
  orderId: string;
  invoiceId?: string;
  invoiceUrl?: string;
  amount: number;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  needsManualPayment?: boolean;
  message?: string;
};
type Err = { message: string };

// Minimal shapes we actually read from Xendit
type XenditInvoice = { id: string; invoice_url: string };
type XenditErrorBody = { message?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isXenditInvoice(v: unknown): v is XenditInvoice {
  return isRecord(v) && typeof v.id === "string" && typeof v.invoice_url === "string";
}
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Server error";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  // Preflight (kalau ada)
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await dbConnect();

    const body = req.body as Payload;
    if (!body?.items?.length) return res.status(400).json({ message: "Items kosong" });
    const amount = Number(body?.amounts?.total ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Total/amount tidak valid" });

    // 1) Simpan order (status awal PENDING)
    const order = await Order.create({
      customer: body.customer,
      items: body.items.map(i => ({
        productId: i.productId, name: i.name, price: i.price, qty: i.qty, imageUrl: i.imageUrl
      })),
      amounts: body.amounts,
      notes: body.notes ?? null,
      payment: { status: "PENDING" },
    });

    // 2) Buat invoice Xendit
    const externalId = `order-${(order._id as Types.ObjectId).toHexString()}`;

    // ==== FIX: tentukan origin yang benar (dev = http, prod = https, env > header) ====
    const originFromEnv =
      process.env.APP_BASE_URL ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL;

    const proto =
      (req.headers["x-forwarded-proto"] as string | undefined) ||
      (process.env.NODE_ENV === "development" ? "http" : "https");

    const host = req.headers.host!;
    const baseUrl = (originFromEnv || `${proto}://${host}`).replace(/\/+$/, "");

    // ==== FIX: thank-you -> thankyou dan pakai path param ====
    const successUrl = `${baseUrl}/thankyou/${order._id}`;
    const failureUrl = `${baseUrl}/payment?order=${order._id}&failed=1`;

    const resp = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Basic auth: username = SECRET KEY, password kosong
        Authorization: "Basic " + Buffer.from(`${process.env.XENDIT_SECRET_KEY}:`).toString("base64"),
      },
      body: JSON.stringify({
        external_id: externalId,
        amount,
        currency: "IDR",
        description: `Pembayaran Pesanan #${order._id}`,
        success_redirect_url: successUrl,
        failure_redirect_url: failureUrl,
      }),
    });

    const text = await resp.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({
        message: `Xendit tidak mengembalikan JSON. Status ${resp.status}. Body: ${text.slice(0, 120)}...`,
      });
    }

    if (!resp.ok) {
      const msg = (isRecord(parsed) && typeof (parsed as XenditErrorBody).message === "string")
        ? (parsed as XenditErrorBody).message!
        : "Gagal membuat invoice ke Xendit";
      return res.status(resp.status).json({ message: msg });
    }

    if (!isXenditInvoice(parsed)) {
      return res.status(502).json({ message: "Format respons Xendit tidak sesuai (id/invoice_url tidak ditemukan)" });
    }

    const data = parsed; // typed as XenditInvoice

    // 3) Simpan info invoice di order
    order.set("payment.providerRef", data.id);
    order.set("payment.invoiceUrl", data.invoice_url);
    order.set("payment.externalId", externalId);
    order.set("payment.status", "PENDING");
    await order.save();

    return res.status(200).json({
      success: true,
      orderId: String(order._id),
      invoiceId: data.id,
      invoiceUrl: data.invoice_url,
      amount,
      status: "PENDING",
    });
  } catch (err: unknown) {
    console.error("Create order error:", err);
    return res.status(500).json({ message: getErrorMessage(err) });
  }
}
