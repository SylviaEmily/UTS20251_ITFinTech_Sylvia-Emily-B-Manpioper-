// pages/api/orders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import { xenditService, type XenditInvoice } from "@/lib/xendit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { customer, items } = req.body as {
      customer: { name: string; email?: string | null; phone?: string | null; address?: string | null };
      items: Array<{ productId: string; name: string; price: number; qty: number }>;
    };

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Items cannot be empty" });
    }

    // Hitung subtotal / PPN 11% / total
    const normalized = items.map((it) => ({
      ...it,
      price: Number(it.price) || 0,
      qty: Math.max(1, Number(it.qty) || 1),
    }));
    const subtotal = normalized.reduce((s, it) => s + it.price * it.qty, 0);
    const tax = Math.round(subtotal * 0.11);
    const total = subtotal + tax;
    if (total <= 0) {
      return res.status(400).json({ message: "Total must be > 0" });
    }

    // 1) Buat Order di DB
    const order = await Order.create({
      customer,
      items: normalized,
      amounts: { subtotal, tax, total, currency: "IDR" },
      payment: { status: "PENDING", provider: "xendit", providerRef: "", invoiceUrl: "" },
    });

    // 2) Buat invoice Xendit via xenditService
    let inv: XenditInvoice;
    try {
      inv = await xenditService.createInvoice({
        externalID: `order_${order._id}`,
        amount: total,
        payerEmail: customer?.email || undefined,
        description: `Pembayaran Order #${order._id}`,
        successRedirectURL: `${process.env.APP_URL}/thankyou/${order._id}`,
        currency: "IDR",
        items: normalized.map((i) => ({ name: i.name, quantity: i.qty, price: i.price })),
        idempotencyKey: `order-${order._id}`,
      });
    } catch (e: unknown) {
      // Tandai order gagal inisialisasi pembayaran
      const msg = e instanceof Error ? e.message : "Xendit service unavailable";
      order.payment.status = "FAILED";
      order.payment.failureReason = msg;
      await order.save();
      return res.status(201).json({
        success: true,
        orderId: String(order._id),
        status: "FAILED",
        needsManualPayment: true,
        message: "Order dibuat tetapi inisialisasi pembayaran gagal. " + msg,
        amount: total,
      });
    }

    if (!inv?.invoice_url) {
      order.payment.status = "FAILED";
      order.payment.failureReason = "Invoice created without URL";
      await order.save();
      return res.status(201).json({
        success: true,
        orderId: String(order._id),
        status: "FAILED",
        needsManualPayment: true,
        message: "Invoice tidak memiliki URL",
        amount: total,
      });
    }

    // 3) Simpan info invoice ke order
    order.payment.providerRef = inv.id;
    order.payment.invoiceUrl = inv.invoice_url;
    order.payment.status = "PENDING";
    await order.save();

    // Tidak ada pengiriman WhatsApp (dihapus sesuai permintaan)

    return res.status(201).json({
      success: true,
      orderId: String(order._id),
      invoiceUrl: inv.invoice_url,
      invoiceId: inv.id,
      amount: total,
      status: "PENDING",
    });
  } catch (err: unknown) {
    console.error(err);
    const msg = err instanceof Error ? err.message : "Failed to create order";
    return res.status(500).json({ message: msg });
  }
}
