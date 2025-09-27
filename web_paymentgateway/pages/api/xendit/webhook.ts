import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '../../lib/mongodb';
import OrderModel from '../../models/0rder';

export const config = {
  api: {
    bodyParser: true, // Xendit kirim JSON
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers['x-callback-token'];
  if (!token || token !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(401).json({ message: 'Invalid callback token' });
  }

  try {
    await dbConnect();

    const payload = req.body;
    // Contoh field utama: id (invoice id), external_id (order id kita), status, paid_at, payment_method
    const invoiceId   = payload?.id;
    const statusRaw   = String(payload?.status || '').toUpperCase();
    const paidAtRaw   = payload?.paid_at;
    const channel     = payload?.payment_method || '';

    // Cari order berdasarkan providerRef (index sudah ada)
    const order = await OrderModel.findOne({ 'payment.providerRef': invoiceId });
    if (!order) {
      // fallback: cari via external_id -> _id kita
      const extId = payload?.external_id;
      if (extId) {
        try {
          const byExt = await OrderModel.findById(extId);
          if (byExt) {
            // sinkronkan providerRef agar next retry lebih mudah
            byExt.payment.providerRef = invoiceId || byExt.payment.providerRef;
            byExt.payment.channel     = channel || byExt.payment.channel;
            await byExt.save();
            return res.status(200).json({ message: 'ok' });
          }
        } catch {}
      }
      console.warn('Order not found for invoice:', invoiceId);
      return res.status(200).json({ message: 'ok' }); // tetap 200 agar tidak flood retry
    }

    // Map status Xendit → schema kamu
    // Xendit: PENDING | PAID | SETTLED | EXPIRED | CANCELED/VOID (tergantung produk)
    if (statusRaw === 'PAID' || statusRaw === 'SETTLED') {
      order.payment.status = 'PAID';              // UI bisa render "LUNAS"
      order.payment.paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();
      order.payment.failureReason = '';
    } else if (statusRaw === 'EXPIRED') {
      // tidak ada EXPIRED di enum kamu → pilih FAILED (atau CANCELLED bila prefer)
      order.payment.status = 'FAILED';
      order.payment.failureReason = 'EXPIRED';
    } else if (statusRaw === 'PENDING') {
      order.payment.status = 'PENDING';
      order.payment.failureReason = '';
    } else if (statusRaw === 'CANCELED' || statusRaw === 'VOID') {
      order.payment.status = 'CANCELLED';
      order.payment.failureReason = statusRaw;
    } else {
      // status lain → tandai FAILED dg reasonnya
      order.payment.status = 'FAILED';
      order.payment.failureReason = statusRaw;
    }

    // Simpan channel kalau berubah
    if (channel) order.payment.channel = channel;

    await order.save();

    return res.status(200).json({ message: 'ok' });
  } catch (e) {
    console.error('Webhook error:', e);
    // Balas 200 supaya Xendit tidak retry berkali-kali; investigasi via log
    return res.status(200).json({ message: 'ok' });
  }
}
