import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import OrderModel from '@/models/order';

type XenditWebhookPayload = {
  id?: string;
  external_id?: string;
  status?: 'PENDING' | 'PAID' | 'EXPIRED' | 'VOIDED' | 'FAILED';
  failure_reason?: string;
};

function parsePayload(u: unknown): XenditWebhookPayload {
  if (typeof u !== 'object' || u === null) return {};
  const o = u as Record<string, unknown>;
  return {
    id: typeof o.id === 'string' ? o.id : undefined,
    external_id: typeof o.external_id === 'string' ? o.external_id : undefined,
    status: typeof o.status === 'string' ? (o.status as XenditWebhookPayload['status']) : undefined,
    failure_reason: typeof o.failure_reason === 'string' ? o.failure_reason : undefined,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  // Validasi callback token (opsional tapi recommended)
  const expected = process.env.XENDIT_CALLBACK_TOKEN;
  const got = req.headers['x-callback-token'];
  if (expected && got !== expected) {
    return res.status(401).json({ message: 'Invalid callback token' });
  }

  try {
    await dbConnect();
    const payload = parsePayload(req.body);
    const orderId = (payload.external_id ?? '').replace(/^ORDER-/, '');
    if (!orderId) return res.status(400).json({ ok: false, message: 'Missing external_id' });

    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    let newStatus: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' = 'PENDING';
    if (payload.status === 'PAID') newStatus = 'PAID';
    else if (payload.status === 'EXPIRED' || payload.status === 'VOIDED') newStatus = 'CANCELLED';
    else if (payload.status === 'FAILED') newStatus = 'FAILED';

    const prev = {
      provider: order.payment?.provider,
      providerRef: order.payment?.providerRef,
      status: order.payment?.status,
      invoiceUrl: order.payment?.invoiceUrl,
      channel: order.payment?.channel,
      paidAt: order.payment?.paidAt,
      failureReason: order.payment?.failureReason,
    };
    order.payment = {
      provider: 'xendit',
      providerRef: payload.id ?? prev.providerRef ?? '',
      status: newStatus,
      invoiceUrl: prev.invoiceUrl ?? '',
      channel: prev.channel ?? '',
      paidAt: newStatus === 'PAID' ? new Date() : prev.paidAt,
      failureReason: (newStatus === 'FAILED' || newStatus === 'CANCELLED') ? (payload.failure_reason ?? '') : '',
    };
    await order.save();

    return res.status(200).json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return res.status(500).json({ ok: false, message });
  }
}
