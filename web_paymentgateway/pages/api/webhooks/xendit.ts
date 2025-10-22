// pages/api/webhooks/xendit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  // validasi method
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // validasi callback token
  const tokenHeader = req.headers["x-callback-token"];
  if (!process.env.XENDIT_CALLBACK_TOKEN || tokenHeader !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(401).json({ message: "Invalid callback token" });
  }

  try {
    const { id, external_id, status } = req.body as {
      id: string; external_id: string; status: string;
    };

    // external_id kita isi "order_<id>"
    const orderId = external_id?.replace("order_", "");
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    // map status Xendit -> status internal
    const map: Record<string, "PENDING" | "PAID" | "FAILED" | "CANCELLED"> = {
      PENDING: "PENDING",
      PAID: "PAID",
      SETTLED: "PAID",
      EXPIRED: "CANCELLED",
      FAILED: "FAILED",
    };
    const newStatus = map[status] ?? "PENDING";

    order.payment.status = newStatus;
    order.payment.providerRef = id || order.payment.providerRef;
    await order.save();

    // Notifikasi WhatsApp telah dihapus sesuai permintaan

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: "Webhook error" });
  }
}
