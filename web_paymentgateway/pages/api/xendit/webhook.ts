import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '../../../lib/mongodb';
import OrderModel from '../../../models/order';
export const config = {
  api: {
    bodyParser: true, // Xendit kirim JSON
  },
};

type XenditInvoiceWebhook = {
  id: string;                 // invoice id
  external_id?: string;       // order id kita (pakai _id string)
  status?: string;            // PENDING | PAID | SETTLED | EXPIRED | CANCELED/VOID
  paid_at?: string;           // ISO date
  payment_method?: string;    // optional
};

function getCallbackTokenFromHeader(h: NextApiRequest['headers']): string | undefined {
  const raw = h['x-callback-token'];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function mapXenditStatusToOrderStatus(statusRaw: string) {
  // schema kamu: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'
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

  // Verifikasi token
  const token = getCallbackTokenFromHeader(req.headers);
  if (!token || token !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(401).json({ message: 'Invalid callback token' });
  }

  try {
    await dbConnect();

    const payload = req.body as XenditInvoiceWebhook;
    const invoiceId = payload?.id;
    if (!invoiceId) {
      // Tidak ada id invoice → tidak bisa diproses, tapi balas 200 agar Xendit tidak retry
      return res.status(200).json({ message: 'ok' });
    }

    const statusRaw = String(payload?.status || '').toUpperCase();
    const channel = payload?.payment_method ?? '';
    const { status, failure } = mapXenditStatusToOrderStatus(statusRaw);

    // Siapkan $set
    const setDoc: Record<string, unknown> = {
      'payment.status': status,
      'payment.channel': channel,
      'payment.failureReason': failure,
    };
    if (status === 'PAID') {
      setDoc['payment.paidAt'] = payload?.paid_at ? new Date(payload.paid_at) : new Date();
    }

    // 1) Coba update berdasarkan providerRef (invoice id)
    const byProviderRef = await OrderModel.updateOne(
      { 'payment.providerRef': invoiceId },
      { $set: setDoc }
    );

    if (byProviderRef.matchedCount === 0) {
      // 2) Fallback: pakai external_id (harusnya = _id order kita)
      const extId = payload?.external_id;
      if (extId) {
        await OrderModel.updateOne(
          { _id: extId },
          {
            $set: {
              ...setDoc,
              'payment.providerRef': invoiceId, // sinkronkan agar next webhook match by providerRef
            },
          }
        );
      } else {
        // Tidak ketemu dokumen & tidak ada external_id — log lalu tetap 200
        console.warn('Order not found for invoice:', invoiceId);
      }
    }

    // Balas cepat agar Xendit anggap sukses
    return res.status(200).json({ message: 'ok' });
  } catch (e: unknown) {
    console.error('Webhook error:', e);
    // Tetap 200 supaya Xendit tidak retry berkali-kali; investigasi via log
    return res.status(200).json({ message: 'ok' });
  }
}
