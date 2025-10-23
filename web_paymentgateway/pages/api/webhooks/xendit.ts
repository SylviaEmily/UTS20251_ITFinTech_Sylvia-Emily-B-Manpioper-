// pages/api/webhooks/xendit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import { sendWhatsApp } from "@/lib/wa";
import { WaTpl } from "@/lib/wa-templates";
import { normalizePhone } from "@/lib/phone";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  // Validasi method
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Validasi callback token (handle string | string[])
  const rawTokenHeader = req.headers["x-callback-token"];
  const tokenHeader = Array.isArray(rawTokenHeader) ? rawTokenHeader[0] : rawTokenHeader;
  if (!process.env.XENDIT_CALLBACK_TOKEN || tokenHeader !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(401).json({ message: "Invalid callback token" });
  }

  try {
    const { id, external_id, status } = req.body as {
      id: string;
      external_id: string;
      status: string;
    };

    // Validasi body minimal
    if (!external_id || !status) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    // external_id kita isi "order_<id>"
    const orderId = external_id.replace(/^order_/, "");
    if (!orderId) {
      return res.status(400).json({ message: "Invalid external_id" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Pastikan field payment ada
    order.payment = order.payment || { status: "PENDING" };

    // Map status Xendit -> status internal (normalize uppercase)
    const incoming = String(status).toUpperCase();
    const map: Record<string, "PENDING" | "PAID" | "FAILED" | "CANCELLED"> = {
      PENDING: "PENDING",
      PAID: "PAID",
      SETTLED: "PAID",
      EXPIRED: "CANCELLED",
      FAILED: "FAILED",
    };
    const newStatus = map[incoming] ?? "PENDING";

    // Simpan status lama untuk cek perubahan
    const oldStatus = order.payment.status;

    order.payment.status = newStatus;
    order.payment.providerRef = id || order.payment.providerRef;
    await order.save();

    // 🎯 KIRIM NOTIFIKASI WA (non-blocking untuk keberhasilan webhook)
    try {
      const phone = normalizePhone(order.customer?.phone || "");
      const appName = process.env.APP_NAME || "MyApp";

      // Kirim notif hanya jika status berubah & ada nomor
      if (oldStatus !== newStatus && phone) {
        if (newStatus === "PAID") {
          // ✅ gunakan amounts.total
          const message = WaTpl.paid(appName, orderId, order.amounts?.total);
          await sendWhatsApp(phone, message);
          console.log(`✅ WA sent (PAID): ${phone}`);
        } else if (newStatus === "FAILED" || newStatus === "CANCELLED") {
          const message = WaTpl.failed(appName, orderId, incoming);
          await sendWhatsApp(phone, message);
          console.log(`✅ WA sent (${newStatus}): ${phone}`);
        }
      }
    } catch (waError) {
      // Jangan gagalkan webhook jika WA error
      console.error("⚠️ Failed to send WA:", waError);
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("Webhook error:", err.message);
    } else {
      console.error("Unknown error in Xendit webhook:", err);
    }
    return res.status(500).json({ message: "Webhook error" });
  }
}
