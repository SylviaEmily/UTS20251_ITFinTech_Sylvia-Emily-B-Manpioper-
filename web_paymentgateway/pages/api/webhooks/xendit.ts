// pages/api/webhooks/xendit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';
import { sendWhatsApp } from '@/lib/whatsapp';
import { WA } from '@/lib/waTemplates';

type XenditInvoiceStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED' | 'VOIDED';
type Payload = {
  id?: string;
  external_id?: string;
  status?: XenditInvoiceStatus;
  amount?: number; // jika Xendit kirim amount, kita pakai. jika tidak ada, fallback ke order.amounts.total
  [k: string]: unknown;
};

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

    // 🔎 log ringkas payload (tanpa data sensitif)
    console.info('[XENDIT] webhook received:', {
      id,
      external_id: externalId,
      status: body?.status,
      amount: body?.amount,
    });

    if (!orderId) return res.status(400).json({ ok: false, message: 'Invalid external_id' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });

    // Update status pembayaran sesuai callback Xendit (tetap sama)
    const newStatus = mapStatus(body?.status);
    order.payment.status = newStatus;
    order.payment.provider = 'xendit';
    order.payment.providerRef = id;
    await order.save();

    console.info('[XENDIT] order updated:', {
      orderId: String(order._id),
      newStatus,
      providerRef: id,
    });

    // ✅ Kirim WhatsApp notifikasi sesuai status (non-blocking terhadap response webhook)
    try {
      const to = order.customer?.phone || '';
      const name = order.customer?.name || 'Customer';
      const amount =
        typeof body?.amount === 'number'
          ? body.amount
          : Number(order.amounts?.total ?? 0); // fallback kalau Xendit tidak kirim amount

      if (!to) {
        console.warn('[WA] webhook notif skipped: empty phone');
      } else if (newStatus === 'PAID') {
        const result = await sendWhatsApp({
          to,
          message: WA.paid({ name, orderId: String(order._id), amount }),
        });
        if (!result.ok) console.error('[WA] paid notif failed:', result);
        else console.info('[WA] paid notif sent →', to);
      } else if (newStatus === 'FAILED' || newStatus === 'CANCELLED') {
        const result = await sendWhatsApp({
          to,
          message: WA.failed({ name, orderId: String(order._id) }),
        });
        if (!result.ok) console.error('[WA] failed/cancelled notif failed:', result);
        else console.info('[WA] failed/cancelled notif sent →', to);
      }
      // PENDING: tidak perlu WA di webhook
    } catch (waErr) {
      // jangan ganggu flow webhook jika WA gagal
      console.error('Failed to send WA on webhook:', waErr);
    }

    return res.status(200).json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error (unknown cause)';
    console.error('Webhook error:', e);
    return res.status(500).json({ ok: false, message: msg });
  }
}
