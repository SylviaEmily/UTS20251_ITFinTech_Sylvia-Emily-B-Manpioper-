// pages/api/webhooks/xendit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import OrderModel from '@/models/order';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // (opsional) validasi token callback
  const token = req.headers['x-callback-token'];
  if (process.env.XENDIT_CALLBACK_TOKEN && token !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(401).json({ message: 'Invalid callback token' });
  }

  try {
    await dbConnect();

    // contoh payload: { id, external_id, status, ... }
    const { id, external_id, status, failure_reason } = (req.body || {}) as any;
    const orderId = String(external_id || '').replace(/^ORDER-/, '');
    if (!orderId) return res.status(400).json({ ok: false, message: 'Missing external_id' });

    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    // Map status
    let newStatus: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' = 'PENDING';
    if (status === 'PAID') newStatus = 'PAID';
    else if (status === 'EXPIRED' || status === 'VOIDED') newStatus = 'CANCELLED';
    else if (status === 'FAILED') newStatus = 'FAILED';

    const prev = order.payment ?? ({} as any);
    order.payment = {
      provider: 'xendit',
      providerRef: id ?? prev.providerRef ?? '',
      status: newStatus,
      invoiceUrl: prev.invoiceUrl ?? '',
      channel: prev.channel ?? '',
      paidAt: newStatus === 'PAID' ? new Date() : prev.paidAt,
      failureReason:
        newStatus === 'FAILED' || newStatus === 'CANCELLED'
          ? (failure_reason || '')
          : '',
    };
    await order.save();

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('Webhook error:', e);
    return res.status(500).json({ ok: false, message: e?.message });
  }
}
