import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '../../lib/mongodb';
import OrderModel from '../../models/order';

const XENDIT_BASE = 'https://api.xendit.co/v2/invoices';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Body frontend: { customer, items, amounts } sesuai schema kamu
    const { customer, items, amounts } = req.body || {};
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items is required and must be non-empty' });
    }
    if (!amounts?.total) {
      return res.status(400).json({ error: 'amounts.total is required' });
    }

    await dbConnect();

    // 1) Buat order lokal dengan status PENDING & provider xendit
    const order = await OrderModel.create({
      customer,
      items,
      amounts,
      payment: {
        provider: 'xendit',
        status: 'PENDING',
      },
    });

    // 2) Buat invoice Xendit (Test Mode karena pakai test secret key)
    const callback_url = `${process.env.APP_URL}/api/xendit/webhook`;

    const resp = await fetch(XENDIT_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(process.env.XENDIT_SECRET_KEY + ':').toString('base64'),
      },
      body: JSON.stringify({
        external_id: order._id.toString(),             // pakai _id order biar gampang trace
        amount: amounts.total,
        currency: amounts.currency || 'IDR',
        payer_email: customer?.email || undefined,
        description: `Order #${order._id}`,
        success_redirect_url: `${process.env.APP_URL}/payment/success?ref=${order._id}`,
        failure_redirect_url: `${process.env.APP_URL}/payment/failed?ref=${order._id}`,
        callback_url,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      // rollback sederhana jika perlu (opsional)
      return res.status(resp.status).json({ error: `Xendit error: ${errText}` });
    }

    const invoice = await resp.json();

    // 3) Update order dengan invoice id & url dari Xendit
    order.payment.providerRef = invoice.id;      // simpan Xendit invoice id
    order.payment.invoiceUrl  = invoice.invoice_url;
    order.payment.channel     = invoice.payment_method || ''; // bila tersedia
    await order.save();

    // 4) Balikkan URL invoice untuk redirect user
    return res.status(200).json({
      orderId: order._id,
      invoiceId: invoice.id,
      checkoutUrl: invoice.invoice_url,
    });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
