// pages/api/payments/xendit/create-invoice.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';

// gunakan REST, biar tipenya gampang
type InvoiceReq = {
  external_id: string;
  amount: number;
  currency?: 'IDR';
  description?: string;
  success_redirect_url?: string;
  failure_redirect_url?: string;
};

type InvoiceOk = { id: string; invoice_url: string };
type InvoiceErr = { message?: string; [k: string]: unknown };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const { orderId } = req.body as { orderId?: string };
    if (!orderId) return res.status(400).json({ message: 'orderId required' });

    await dbConnect();
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const payload: InvoiceReq = {
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
        Authorization: 'Basic ' + Buffer.from(String(process.env.XENDIT_SECRET_KEY) + ':').toString('base64'),
      },
      body: JSON.stringify(payload),
    });

    const raw: unknown = await r.json();

    if (!r.ok) {
      const ebody = raw as InvoiceErr | undefined;
      const msg = ebody?.message ?? `Failed to create invoice (HTTP ${r.status})`;
      return res.status(r.status).json({ message: msg });
    }

    // narrow
    const ok =
      typeof raw === 'object' &&
      raw !== null &&
      'id' in raw &&
      'invoice_url' in raw &&
      typeof (raw as Record<string, unknown>).id === 'string' &&
      typeof (raw as Record<string, unknown>).invoice_url === 'string';

    if (!ok) return res.status(500).json({ message: 'Unexpected response from Xendit' });

    const data = raw as InvoiceOk;

    order.payment.provider = 'xendit';
    order.payment.providerRef = data.id;
    order.payment.status = 'PENDING';
    await order.save();

    return res.status(200).json({ invoiceId: data.id, invoiceUrl: data.invoice_url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal error (unknown cause)';
    console.error('Create invoice error:', e);
    return res.status(500).json({ message: msg });
  }
}
