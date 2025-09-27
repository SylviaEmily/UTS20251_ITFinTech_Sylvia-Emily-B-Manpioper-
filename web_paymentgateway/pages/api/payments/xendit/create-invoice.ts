// pages/api/payments/xendit/create-invoice.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const { orderId } = req.body as { orderId: string };
    if (!orderId) return res.status(400).json({ message: 'orderId required' });

    await dbConnect();
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const payload = {
      external_id: `ORDER-${order._id}`,
      amount: order.amounts.total,
      currency: 'IDR',
      description: `Payment for order ${order._id}`,
      success_redirect_url: `${process.env.APP_URL}/thankyou/${order._id}`,
      failure_redirect_url: `${process.env.APP_URL}/payment?failed=1`,
    };

    const r = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Basic auth: `secretKey:` (kolon di akhir!)
        Authorization: 'Basic ' + Buffer.from(process.env.XENDIT_SECRET_KEY + ':').toString('base64'),
      },
      body: JSON.stringify(payload),
    });

    const d = await r.json();
    if (!r.ok) {
      console.error('Xendit error:', d);
      return res.status(r.status).json({ message: d?.message || 'Failed to create invoice' });
    }

    order.payment.provider = 'xendit';
    order.payment.providerRef = d.id;
    order.payment.status = 'PENDING';
    await order.save();

    return res.status(200).json({ invoiceId: d.id, invoiceUrl: d.invoice_url });
  } catch (e: any) {
    console.error('Create invoice error:', e);
    return res.status(500).json({ message: e?.message || 'Internal error' });
  }
}
