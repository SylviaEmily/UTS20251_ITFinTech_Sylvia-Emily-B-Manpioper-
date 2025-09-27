import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import OrderModel from '@/models/Order';

type CheckoutItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  lineTotal: number;
};

type CheckoutAmounts = {
  subtotal: number;
  tax: number;
  shipping?: number;
  total: number;
  currency?: string;
};

type CheckoutCustomer = {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  email?: string;
};

type CheckoutBody = {
  customer?: CheckoutCustomer;
  items: CheckoutItem[];
  amounts: CheckoutAmounts;
};

const XENDIT_BASE = 'https://api.xendit.co/v2/invoices';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { customer, items, amounts } = req.body as CheckoutBody;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items is required and must be non-empty' });
    }
    if (!amounts?.total) {
      return res.status(400).json({ error: 'amounts.total is required' });
    }

    await dbConnect();

    // 1) Buat order lokal
    const order = await OrderModel.create({
      customer,
      items,
      amounts,
      payment: { provider: 'xendit', status: 'PENDING' },
    });

    // 2) Buat invoice Xendit (Test Mode)
    const callback_url = `${process.env.APP_URL}/api/xendit/webhook`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization:
        'Basic ' + Buffer.from(`${process.env.XENDIT_SECRET_KEY}:`).toString('base64'),
    };

    const resp = await fetch(XENDIT_BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        external_id: order._id.toString(),
        amount: amounts.total,
        currency: amounts.currency ?? 'IDR',
        payer_email: customer?.email || undefined,
        description: `Order #${order._id}`,
        success_redirect_url: `${process.env.APP_URL}/payment/success?ref=${order._id}`,
        failure_redirect_url: `${process.env.APP_URL}/payment/failed?ref=${order._id}`,
        callback_url,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: `Xendit error: ${errText}` });
    }

    interface XenditInvoiceResp {
      id: string;
      invoice_url: string;
      payment_method?: string | null;
    }
    const invoice: XenditInvoiceResp = await resp.json();

    // 3) Atomic update
    await OrderModel.updateOne(
      { _id: order._id },
      {
        $set: {
          'payment.providerRef': invoice.id,
          'payment.invoiceUrl': invoice.invoice_url,
          'payment.channel': invoice.payment_method ?? '',
          'payment.provider': 'xendit',
          'payment.status': 'PENDING',
        },
      }
    );

    return res.status(200).json({
      orderId: order._id,
      invoiceId: invoice.id,
      checkoutUrl: invoice.invoice_url,
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'Unexpected error while creating invoice';
    console.error('Checkout error:', e);
    return res.status(500).json({ error: message });
  }
}
