import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';

type XenditInvoiceStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED' | 'VOIDED';
type Payload = { id?: string; external_id?: string; status?: XenditInvoiceStatus; [k: string]: unknown };

function mapStatus(s?: XenditInvoiceStatus) {
  if (s === 'PAID') return 'PAID' as const;
  if (s === 'EXPIRED' || s === 'VOIDED') return 'CANCELLED' as const;
  if (s === 'FAILED') return 'FAILED' as const;
  return 'PENDING' as const;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers['x-callback-token'] as string | undefined;
  if (process.env.XENDIT_CALLBACK_TOKEN && token !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(401).json({ message: 'Invalid callback token' });
  }

  try {
    await dbConnect();
    const body = req.body as Payload | undefined;
    const id = body?.id ?? '';
    const externalId = body?.external_id ?? '';
    const orderId = externalId.startsWith('ORDER-') ? externalId.replace('ORDER-', '') : '';

    if (!orderId) return res.status(400).json({ ok: false, message: 'Invalid external_id' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    order.payment.status = mapStatus(body?.status);
    order.payment.provider = 'xendit';
    order.payment.providerRef = id;
    await order.save();

    return res.status(200).json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error (unknown cause)';
    console.error('Webhook error:', e);
    return res.status(500).json({ ok: false, message: msg });
  }
}
