import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import OrderModel from '@/models/order';

type CreateInvoiceBody = { orderId?: string };
type XenditInvoiceResponse = { id: string; invoice_url?: string; invoiceUrl?: string; message?: string; };

function isXenditInvoiceResponse(x: unknown): x is XenditInvoiceResponse {
  return typeof x === 'object' && x !== null && 'id' in x;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const { orderId } = (req.body ?? {}) as CreateInvoiceBody;
    if (!orderId) return res.status(400).json({ message: 'orderId required' });

    const secret = process.env.XENDIT_SECRET_KEY;
    if (!secret) return res.status(500).json({ message: 'Missing XENDIT_SECRET_KEY' });

    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

    await dbConnect();
    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const amount = order.amounts?.total ?? 0;
    if (amount <= 0) return res.status(400).json({ message: 'Invalid order amount' });

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

    const dataUnknown: unknown = await resp.json();
    if (!resp.ok) {
      const message =
        (typeof dataUnknown === 'object' && dataUnknown !== null && 'message' in dataUnknown
          ? String((dataUnknown as { message?: unknown }).message ?? 'Xendit error')
          : 'Xendit error');
      return res.status(resp.status).json({ message, detail: dataUnknown });
    }
    if (!isXenditInvoiceResponse(dataUnknown)) {
      return res.status(500).json({ message: 'Unexpected response from Xendit' });
    }

    const invUrl = dataUnknown.invoice_url || dataUnknown.invoiceUrl || '';

    // simpan jejak invoice
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
      providerRef: dataUnknown.id,
      status: 'PENDING',
      invoiceUrl: invUrl,
      channel: prev.channel ?? '',
      paidAt: prev.paidAt,
      failureReason: '',
    };
    await order.save();

    return res.status(200).json({ invoiceId: dataUnknown.id, invoiceUrl: invUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return res.status(500).json({ message });
  }
}
