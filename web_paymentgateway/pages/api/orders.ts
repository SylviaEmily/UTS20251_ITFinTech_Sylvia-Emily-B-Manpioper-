// pages/api/orders.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import OrderModel, { type OrderBase } from '@/models/order';

type CreateOrderBody = {
  customer?: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    email?: string | null;
  };
  items: Array<{
    productId: string;
    name: string;
    price: number;
    qty: number;
    lineTotal?: number;
  }>;
  amounts?: {
    subtotal?: number | null;
    tax?: number | null;
    shipping?: number | null;
    total?: number | null;
    currency?: string | null;
  };
  provider?: 'manual' | 'xendit' | 'midtrans' | 'stripe';
};

const toStr = (v: unknown): string => (typeof v === 'string' ? v : '');
const toNum = (v: unknown, def = 0): number =>
  typeof v === 'number' && !Number.isNaN(v) ? v : def;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    await dbConnect();
    const body = req.body as CreateOrderBody;

    // ----- build items (plain objects) -----
    const items = (body.items ?? []).map((it) => {
      const price = toNum(it.price, 0);
      const qty = Math.max(1, toNum(it.qty, 1)); // minimal 1
      return {
        productId: toStr(it.productId),
        name: toStr(it.name),
        price,
        qty,
        lineTotal: toNum(it.lineTotal, price * qty),
        // imageUrl: toStr((it as { imageUrl?: string }).imageUrl || ''), // aktifkan jika field ada di schema
      };
    });

    if (items.length === 0) {
      return res.status(400).json({ message: 'Items cannot be empty' });
    }

    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const tax = toNum(body.amounts?.tax, toNum(body.amounts?.subtotal) ? 0 : 0); // biarkan dari client, default 0
    const shipping = toNum(body.amounts?.shipping, 0);
    const total = toNum(body.amounts?.total, subtotal + tax + shipping);

    // ----- JANGAN anotasi data dengan OrderBase di sini -----
    const data = {
      customer: {
        name: toStr(body.customer?.name),
        phone: toStr(body.customer?.phone),
        address: toStr(body.customer?.address),
        city: toStr(body.customer?.city),
        postalCode: toStr(body.customer?.postalCode),
        email: toStr(body.customer?.email),
      },
      items,
      amounts: {
        subtotal,
        tax,
        shipping,
        total,
        currency: toStr(body.amounts?.currency) || 'IDR',
      },
      payment: {
        provider: body.provider ?? 'manual',
        status: 'PENDING' as const,
        providerRef: '',
        invoiceUrl: '',
        channel: '',
        failureReason: '',
      },
    };

    // ----- CAST hanya saat create -----
    const doc = await OrderModel.create(data as unknown as OrderBase);

    return res.status(201).json({
      orderId: String(doc._id),
      status: doc.payment?.status ?? 'PENDING',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return res.status(500).json({ message: msg });
  }
}
