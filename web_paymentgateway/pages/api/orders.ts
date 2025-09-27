// pages/api/orders.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import OrderModel from '@/models/order'; // <- pakai huruf kecil konsisten

// ----- tipe input aman untuk create -----
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
    imageUrl?: string;
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

// helper sanitasi
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const n = (v: unknown, d = 0) => (typeof v === 'number' && !Number.isNaN(v) ? v : d);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  await dbConnect();

  const body = req.body as CreateOrderBody;

  // map items -> array plain object
  const items = (body.items || []).map((it) => ({
    productId: s(it.productId),
    name: s(it.name),
    price: n(it.price, 0),
    qty: n(it.qty, 0),
    lineTotal: n(it.lineTotal, n(it.price, 0) * n(it.qty, 0)),
    imageUrl: s(it.imageUrl),
  }));

  if (items.length === 0) {
    return res.status(400).json({ message: 'Items cannot be empty' });
  }

  // gunakan tipe input plain; biarkan Mongoose yang cast
  const orderData = {
    customer: {
      name: s(body.customer?.name),
      phone: s(body.customer?.phone),
      address: s(body.customer?.address),
      city: s(body.customer?.city),
      postalCode: s(body.customer?.postalCode),
      email: s(body.customer?.email),
    },
    items,
    amounts: {
      subtotal: n(body.amounts?.subtotal),
      tax: n(body.amounts?.tax),
      shipping: n(body.amounts?.shipping),
      total: n(body.amounts?.total),
      currency: s(body.amounts?.currency) || 'IDR',
    },
    payment: {
      provider: body.provider ?? 'manual',
      status: 'PENDING',
      providerRef: '',
      invoiceUrl: '',
      channel: '',
      failureReason: '',
    },
  } as any; // <-- cast agar tidak bentrok dengan tipe Document internal Mongoose

  const doc = await OrderModel.create(orderData);

  return res.status(201).json({
    orderId: String(doc._id),
    status: doc.payment?.status ?? 'PENDING', // aman dari undefined
  });
}
