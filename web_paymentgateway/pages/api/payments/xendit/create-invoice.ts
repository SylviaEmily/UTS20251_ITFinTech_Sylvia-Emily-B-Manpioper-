// pages/api/payments/xendit/create-invoice.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import OrderModel from '@/models/order';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const { orderId } = (req.body || {}) as { orderId?: string };
    if (!orderId) return res.status(400).json({ message: 'orderId required' });

    const secret = process.env.XENDIT_SECRET_KEY;
    if (!secret) return res.status(500).json({ message: 'Missing XENDIT_SECRET_KEY' });

    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

    await dbConnect();
    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const amount = order.amounts?.total ?? 0;
    if (amount <= 0) return res.status(400).json({ message: 'Invalid order amount' });

    // Payload Invoices v2
    const payload = {
      external_id: `ORDER-${order._id}`,
      amount,
      currency: 'IDR',
      description: `Payment for order ${order._id}`,
      success_redirect_url: `${appUrl}/thankyou/${order._id}`,
      failure_redirect_url: `${appUrl}/payment?failed=1`,
    };

    const resp = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${secret}:`).toString('base64'),
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({
        message: data?.message || 'Xendit error',
        detail: data,
      });
    }

    // Pastikan payment object ada (agar TS tidak protes)
    const prev = order.payment ?? ({} as any);
    order.payment = {
      provider: 'xendit',
      providerRef: data.id ?? '',
      status: 'PENDING',
      invoiceUrl: data.invoice_url || data.invoiceUrl || '',
      channel: prev.channel || '',
      paidAt: prev.paidAt,
      failureReason: '',
    };
    await order.save();

    return res.status(200).json({
      invoiceId: data.id,
      invoiceUrl: data.invoice_url || data.invoiceUrl,
    });
  } catch (e: any) {
    console.error('Create invoice error:', e);
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
