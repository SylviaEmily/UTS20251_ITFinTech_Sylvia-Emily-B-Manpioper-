// pages/api/orders.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import OrderModel, { type Order, type OrderBase, type OrderItem } from '@/models/Order';

type CreateOrderPayload = {
  customer: NonNullable<OrderBase['customer']>;
  items: OrderItem[];
  amounts: NonNullable<OrderBase['amounts']>;
  /** client mengirim provider di root payload; server akan memetakan ke payment.provider */
  provider?: 'manual' | 'midtrans' | 'xendit' | 'stripe';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await dbConnect();

    if (req.method === 'POST') {
      const body = req.body as CreateOrderPayload;

      // (opsional) validasi minimal
      if (!body?.items?.length) {
        return res.status(400).json({ message: 'Items kosong' });
      }

      const doc: Order = await OrderModel.create({
        customer: body.customer,
        items: body.items,
        amounts: {
          subtotal: body.amounts?.subtotal ?? 0,
          tax: body.amounts?.tax ?? 0,
          shipping: body.amounts?.shipping ?? 0,
          total: body.amounts?.total ?? 0,
          currency: body.amounts?.currency ?? 'IDR',
        },
        payment: {
          provider: body.provider ?? 'manual',
          status: 'PENDING',
          providerRef: undefined,
        },
      } as OrderBase);

      return res
        .status(201)
        .json({ orderId: doc._id.toString(), status: doc.payment?.status ?? 'PENDING' });
    }

    if (req.method === 'GET') {
      const list = await OrderModel.find().sort({ createdAt: -1 }).lean();
      return res.status(200).json(list);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (err) {
    console.error('API /orders error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
