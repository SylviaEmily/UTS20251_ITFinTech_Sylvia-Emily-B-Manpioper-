// pages/api/orders.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import OrderModel, { type OrderBase } from '@/models/Order';
import { xenditService, type XenditInvoice } from '@/lib/xendit';

type CreateOrderBody = {
  customer?: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    email?: string | null;
  };
  items: Array<{
    productId: string;
    name: string;
    price: number;
    qty: number;
    lineTotal?: number;
  }>;
  amounts?: {
    subtotal?: number | null;
    tax?: number | null;
    shipping?: number | null;
    total?: number | null;
    currency?: string | null;
  };
  provider?: 'manual' | 'xendit' | 'midtrans' | 'stripe';
};

const toStr = (v: unknown): string => (typeof v === 'string' ? v : '');
const toNum = (v: unknown, def = 0): number =>
  typeof v === 'number' && !Number.isNaN(v) ? v : def;

type ApiOk =
  | {
      success: true;
      orderId: string;
      invoiceUrl: string;
      invoiceId: string;
      amount: number;
      status: 'PENDING';
    }
  | {
      success: true;
      orderId: string;
      status: 'FAILED';
      needsManualPayment: true;
      message: string;
      amount: number;
    };

type ApiErr = { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiOk | ApiErr>
) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    await dbConnect();
    const body = req.body as CreateOrderBody;

    // ----- build items (POJO) -----
    const items = (body.items ?? []).map((it) => {
      const price = toNum(it.price, 0);
      const qty = Math.max(1, toNum(it.qty, 1));
      return {
        productId: toStr(it.productId),
        name: toStr(it.name),
        price,
        qty,
        lineTotal: toNum(it.lineTotal, price * qty),
      };
    });
    if (items.length === 0) return res.status(400).json({ message: 'Items cannot be empty' });

    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const tax = toNum(body.amounts?.tax, 0);
    const shipping = toNum(body.amounts?.shipping, 0);
    const total = toNum(body.amounts?.total, subtotal + tax + shipping);
    if (total <= 0) return res.status(400).json({ message: 'Total must be > 0' });

    // ----- build order data (POJO, TIDAK diketik sebagai OrderBase) -----
    const data = {
      customer: {
        name: toStr(body.customer?.name),
        phone: toStr(body.customer?.phone),
        address: toStr(body.customer?.address),
        city: toStr(body.customer?.city),
        postalCode: toStr(body.customer?.postalCode),
        email: toStr(body.customer?.email),
      },
      items,
      amounts: {
        subtotal,
        tax,
        shipping,
        total,
        currency: toStr(body.amounts?.currency) || 'IDR',
      },
      payment: {
        provider: body.provider ?? 'xendit',
        status: 'PENDING' as const,
        providerRef: '',
        invoiceUrl: '',
        channel: '',
        failureReason: '',
      },
      notes: '',
    };

    // ----- create order in DB (cast BARU di sini) -----
    const order = await OrderModel.create(data as unknown as OrderBase);

    // ----- create Xendit invoice -----
    try {
      const inv: XenditInvoice = await xenditService.createInvoice({
        externalID: `ORDER-${order._id}`,
        amount: total,
        payerEmail: toStr(body.customer?.email),
        description: `Payment for order ${order._id}`,
        successRedirectURL: `${process.env.APP_URL}/thankyou/${order._id}`,
        failureRedirectURL: `${process.env.APP_URL}/payment?failed=1`,
        currency: 'IDR',
        items: items.map((i) => ({ name: i.name, quantity: i.qty, price: i.price })),
        idempotencyKey: `order-${order._id}`,
      });

      if (!inv?.invoice_url) {
        order.payment.status = 'FAILED';
        order.payment.failureReason = 'Invoice created without URL';
        await order.save();
        return res.status(201).json({
          success: true,
          orderId: String(order._id),
          status: 'FAILED',
          needsManualPayment: true,
          message: 'Invoice tidak memiliki URL',
          amount: total,
        });
      }

      order.payment.provider = 'xendit';
      order.payment.providerRef = inv.id;
      order.payment.invoiceUrl = inv.invoice_url;
      order.payment.status = 'PENDING';
      await order.save();

      return res.status(201).json({
        success: true,
        orderId: String(order._id),
        invoiceUrl: inv.invoice_url,
        invoiceId: inv.id,
        amount: total,
        status: 'PENDING',
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Xendit service unavailable';
      order.payment.status = 'FAILED';
      order.payment.failureReason = msg;
      await order.save();

      return res.status(201).json({
        success: true,
        orderId: String(order._id),
        status: 'FAILED',
        needsManualPayment: true,
        message: 'Order dibuat tetapi inisialisasi pembayaran gagal. ' + msg,
        amount: total,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return res.status(500).json({ message: msg });
  }
}
