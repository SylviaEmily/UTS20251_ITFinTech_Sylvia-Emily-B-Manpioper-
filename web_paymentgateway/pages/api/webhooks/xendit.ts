import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Optional but recommended: verify callback token
  const token = req.headers['x-callback-token'];
  if (process.env.XENDIT_CALLBACK_TOKEN && token !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(401).json({ message: 'Invalid callback token' });
  }

  try {
    await dbConnect();

    // Example payload: { id, external_id, status, ... }
    const { id, external_id, status } = (req.body as any) || {};
    const orderId = String(external_id || '').replace('ORDER-', '');

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    let newStatus: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' = 'PENDING';
    if (status === 'PAID') newStatus = 'PAID';
    else if (status === 'EXPIRED' || status === 'VOIDED') newStatus = 'CANCELLED';
    else if (status === 'FAILED') newStatus = 'FAILED';

    order.payment.status = newStatus;
    order.payment.provider = 'xendit';
    order.payment.providerRef = id;
    await order.save();

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('Webhook error:', e);
    return res.status(500).json({ ok: false, message: e?.message });
  }
}
