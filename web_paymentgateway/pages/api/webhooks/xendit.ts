// pages/api/webhooks/xendit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import mongoose from "mongoose";
import { sendWhatsApp } from "@/lib/wa";
import { WaTpl } from "@/lib/wa-templates";
import { normalizePhone } from "@/lib/phone";

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
    const b: any = req.body || {};
    // Terima snake / camel case
    const statusRaw: string = b.status || b.invoice_status || "";
    const externalRaw: string = b.external_id || b.externalId || b.externalID || "";
    const invoiceId: string = b.id || b.invoice_id || b.invoiceId || "";

    if (!statusRaw) {
      return res.status(400).json({ message: "Missing status" });
    }

    // === Resolve Order ===
    let order = null;

    // (1) external_id: "order_<ObjectId>"
    if (externalRaw && /^order_/.test(String(externalRaw))) {
      const maybeId = String(externalRaw).replace(/^order_/, "");
      if (mongoose.isValidObjectId(maybeId)) {
        order = await Order.findById(maybeId);
      }
    }

    // (2) fallback pakai invoice id dari Xendit yang kita simpan di providerRef
    if (!order && invoiceId) {
      order = await Order.findOne({ "payment.providerRef": invoiceId });
    }

    // (3) fallback opsional kalau kamu juga menyimpan externalId di payment
    if (!order && externalRaw) {
      order = await Order.findOne({ "payment.externalId": externalRaw });
    }

    if (!order) {
      // 404 agar kelihatan mismatch payload, bukan 500
      return res.status(404).json({ message: "Order not found for webhook payload" });
    }

    // Pastikan struktur payment ada
    order.payment = order.payment || { status: "PENDING" };

    // Normalisasi & map status
    const incoming = String(statusRaw).toUpperCase();
    const map: Record<string, "PENDING" | "PAID" | "FAILED" | "CANCELLED"> = {
      PENDING: "PENDING",
      PAID: "PAID",
      SETTLED: "PAID",
      EXPIRED: "CANCELLED",
      FAILED: "FAILED",
    };
    const newStatus = map[incoming] ?? "PENDING";
    const oldStatus = order.payment.status;

    // Simpan providerRef (invoice id) bila ada
    if (invoiceId) order.payment.providerRef = invoiceId;
    order.payment.status = newStatus;
    await order.save();

    // ===== Kirim WhatsApp (non-blocking) =====
    try {
      const phone = normalizePhone(order.customer?.phone || "");
      const appName = process.env.APP_NAME || "MyApp";
      if (oldStatus !== newStatus && phone) {
        if (newStatus === "PAID") {
          // WaTpl.paid menerima 3 argumen: (appName, orderId, amount)
          const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
          const thankyou = `${base}/thankyou/${String(order._id)}`;

          const baseMsg = WaTpl.paid(appName, String(order._id), order.amounts?.total);
          const msg = `${baseMsg}\n\nLihat status & rincian pesanan: ${thankyou}`;

          await sendWhatsApp(phone, msg);
        } else if (newStatus === "FAILED" || newStatus === "CANCELLED") {
          const msg = WaTpl.failed(appName, String(order._id), incoming);
          await sendWhatsApp(phone, msg);
        }
      }
    } catch (e) {
      console.error("WA send error:", e);
      // jangan gagalkan webhook
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Webhook error:", err?.message || err);
    return res.status(500).json({ message: "Webhook error" });
  }
}
