import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import OrderModel from '@/models/Order';

export const config = {
  api: {
    bodyParser: true,
  },
};

type XenditInvoiceWebhook = {
  id: string;
  external_id?: string;
  status?: string;
  paid_at?: string;
  payment_method?: string;
};

function getCallbackTokenFromHeader(h: NextApiRequest['headers']): string | undefined {
  const raw = h['x-callback-token'];
  return Array.isArray(raw) ? raw[0] : raw;
}

function mapXenditStatusToOrderStatus(statusRaw: string) {
  switch (statusRaw) {
    case 'PAID':
    case 'SETTLED':
      return { status: 'PAID' as const, failure: '' };
    case 'PENDING':
      return { status: 'PENDING' as const, failure: '' };
    case 'EXPIRED':
      return { status: 'FAILED' as const, failure: 'EXPIRED' };
    case 'CANCELED':
    case 'VOID':
      return { status: 'CANCELLED' as const, failure: statusRaw };
    default:
      return { status: 'FAILED' as const, failure: statusRaw || 'UNKNOWN' };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = getCallbackTokenFromHeader(req.headers);
  if (!token || token !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(401).json({ message: 'Invalid callback token' });
  }

  try {
    await dbConnect();

    const payload = req.body as XenditInvoiceWebhook;
    const invoiceId = payload?.id;
    if (!invoiceId) return res.status(200).json({ message: 'ok' });

    const statusRaw = String(payload?.status || '').toUpperCase();
    const channel = payload?.payment_method ?? '';
    const { status, failure } = mapXenditStatusToOrderStatus(statusRaw);

    const setDoc: Record<string, unknown> = {
      'payment.status': status,
      'payment.channel': channel,
      'payment.failureReason': failure,
    };
    if (status === 'PAID') {
      setDoc['payment.paidAt'] = payload?.paid_at ? new Date(payload.paid_at) : new Date();
    }

    const byProviderRef = await OrderModel.updateOne(
      { 'payment.providerRef': invoiceId },
      { $set: setDoc }
    );

    if (byProviderRef.matchedCount === 0) {
      const extId = payload?.external_id;
      if (extId) {
        await OrderModel.updateOne(
          { _id: extId },
          { $set: { ...setDoc, 'payment.providerRef': invoiceId } }
        );
      } else {
        console.warn('Order not found for invoice:', invoiceId);
      }
    }

    return res.status(200).json({ message: 'ok' });
  } catch (e: unknown) {
    console.error('Webhook error:', e);
    return res.status(200).json({ message: 'ok' });
  }
}
