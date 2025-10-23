// pages/api/orders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import { xenditService } from "@/lib/xendit";
import { notifyCheckout } from "@/lib/notify-order";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { customer, items, amounts, notes } = req.body as {
      customer: { name: string; email?: string | null; phone?: string | null; address?: string | null };
      items: Array<{ productId?: string; name: string; price: number; qty: number }>;
      amounts: { subtotal: number; tax: number; total: number; currency?: string };
      notes?: string;
    };

    // 1️⃣ Buat order di database
    const order = await Order.create({
      customer,
      items,
      amounts,
      notes,
      payment: {
        provider: "xendit",
        status: "PENDING",
      },
    });

    // 2️⃣ Buat invoice di Xendit
    const invoice = await xenditService.createInvoice({
      externalID: `order_${order._id}`,
      amount: amounts.total,
      description: `Order #${order._id}`,
      successRedirectURL: `${process.env.NEXT_PUBLIC_BASE_URL}/order/success?id=${order._id}`,
      failureRedirectURL: `${process.env.NEXT_PUBLIC_BASE_URL}/order/failed?id=${order._id}`,
      items: items.map((it) => ({
        name: it.name,
        quantity: it.qty,
        price: it.price,
      })),
      // ✅ hanya sertakan payerEmail jika ada (hindari 'null' masuk ke tipe string | undefined)
      ...(customer?.email ? { payerEmail: customer.email } : {}),
    });

    // 3️⃣ Update order dengan invoice URL
    order.payment.invoiceUrl = invoice.invoice_url;
    order.payment.providerRef = invoice.id;
    await order.save();

    // 4️⃣ 🎯 KIRIM NOTIFIKASI WA CHECKOUT
    await notifyCheckout(order);

    return res.status(201).json({
      success: true,
      orderId: order._id, // tetap mengikuti contoh implementasi
      invoiceUrl: invoice.invoice_url,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("Order creation error:", err.message);
      return res.status(500).json({ message: err.message });
    }
    return res.status(500).json({ message: "Failed to create order" });
  }
}
