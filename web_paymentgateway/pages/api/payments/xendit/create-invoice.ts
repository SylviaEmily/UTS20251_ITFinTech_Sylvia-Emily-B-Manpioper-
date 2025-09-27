// pages/api/payments/xendit/create-invoice.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';

type InvoiceCreateRequest = {
  external_id: string;
  amount: number;
  currency?: 'IDR';
  description?: string;
  success_redirect_url?: string;
  failure_redirect_url?: string;
};

type InvoiceCreateSuccess = {
  id: string;
  invoice_url: string;
};

type InvoiceCreateError = {
  message?: string;
  error_code?: string;
  [k: string]: unknown;
};

function isInvoiceCreateSuccess(x: unknown): x is InvoiceCreateSuccess {
  return (
    typeof x === 'object' &&
    x !== null &&
    'id' in x &&
    'invoice_url' in x &&
    typeof (x as any).id === 'string' &&
    typeof (x as any).invoice_url === 'string'
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST')
    return res.status(405).json({ message: 'Method not allowed' });

  try {
    const { orderId } = req.body as { orderId?: string };
    if (!orderId) return res.status(400).json({ message: 'orderId required' });

    await dbConnect();
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const payload: InvoiceCreateRequest = {
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
        // Basic auth: `secretKey:` (kolon di akhir)
        Authorization:
          'Basic ' +
          Buffer.from(String(process.env.XENDIT_SECRET_KEY) + ':').toString(
            'base64'
          ),
      },
      body: JSON.stringify(payload),
    });

    const raw = (await r.json()) as unknown;

    if (!r.ok) {
      const errBody = raw as InvoiceCreateError;
      const msg =
        errBody?.message ??
        `Failed to create invoice (HTTP ${r.status}).`;
      return res.status(r.status).json({ message: msg });
    }

    if (!isInvoiceCreateSuccess(raw)) {
      return res
        .status(500)
        .json({ message: 'Unexpected response from Xendit' });
    }

    order.payment.provider = 'xendit';
    order.payment.providerRef = raw.id;
    order.payment.status = 'PENDING';
    await order.save();

    return res
      .status(200)
      .json({ invoiceId: raw.id, invoiceUrl: raw.invoice_url });
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : 'Internal error (unknown cause)';
    console.error('Create invoice error:', e);
    return res.status(500).json({ message: msg });
  }
}
