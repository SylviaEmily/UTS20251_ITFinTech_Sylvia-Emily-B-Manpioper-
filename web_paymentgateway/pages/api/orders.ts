import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order'; // pastikan casing file = 'models/order.ts'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    await dbConnect();

    const { customer, items, amounts, provider = 'manual' } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items required' });
    }

    const safeItems = items.map((it: any) => ({
      productId: String(it.productId),
      name: String(it.name),
      price: Number(it.price),
      qty: Number(it.qty),
      lineTotal: Number(it.lineTotal),
    }));

    const subtotal = Number(amounts?.subtotal ?? safeItems.reduce((s, it) => s + it.lineTotal, 0));
    const tax      = Number(amounts?.tax ?? 0);
    const shipping = Number(amounts?.shipping ?? 0);
    const total    = Number(amounts?.total ?? subtotal + tax + shipping);

    const order = await Order.create({
      customer: {
        name: customer?.name ?? '',
        phone: customer?.phone ?? '',
        address: customer?.address ?? '',
        city: customer?.city ?? '',
        postalCode: customer?.postalCode ?? '',
      },
      items: safeItems,
      amounts: { subtotal, tax, shipping, total, currency: 'IDR' },
      payment: { provider, status: 'PENDING' },
    });

    return res.status(201).json({ orderId: order._id, status: order.payment.status });
  } catch (err: any) {
    console.error('POST /api/orders error:', err);
    // pastikan selalu JSON
    return res.status(500).json({ message: err?.message || 'Internal error' });
  }
}
