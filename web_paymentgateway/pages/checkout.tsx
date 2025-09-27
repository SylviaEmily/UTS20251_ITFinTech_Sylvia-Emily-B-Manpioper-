import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import OrderModel, { type OrderBase } from '@/models/Order';
import { xenditService } from '@/lib/xendit';

interface CheckoutItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  imageUrl?: string;
}

interface CheckoutRequest {
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    postalCode: string;
  };
  items: CheckoutItem[];
  amounts: {
    subtotal?: number;
    tax?: number;
    shipping?: number;
    total?: number;
    currency?: string;
  };
  notes?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const body: CheckoutRequest = req.body;

    // Validate required fields
    if (!body.customer?.email || !body.items || body.items.length === 0) {
      return res.status(400).json({ 
        message: 'Missing required fields: customer email and items are required' 
      });
    }

    // Calculate amounts
    const items = body.items.map(item => ({
      ...item,
      lineTotal: item.price * item.qty,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const tax = body.amounts?.tax || 0;
    const shipping = body.amounts?.shipping || 0;
    const total = body.amounts?.total || (subtotal + tax + shipping);

    if (total <= 0) {
      return res.status(400).json({ message: 'Total amount must be greater than 0' });
    }

    // Create order in database
    const orderData: OrderBase = {
      customer: {
        name: body.customer.name,
        phone: body.customer.phone,
        email: body.customer.email,
        address: body.customer.address,
        city: body.customer.city,
        postalCode: body.customer.postalCode,
      },
      items,
      amounts: {
        subtotal,
        tax,
        shipping,
        total,
        currency: body.amounts?.currency || 'IDR',
      },
      payment: {
        provider: 'xendit',
        status: 'PENDING',
        providerRef: '',
        invoiceUrl: '',
        channel: '',
        failureReason: '',
      },
      notes: body.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const order = await OrderModel.create(orderData);

    try {
      // Create Xendit invoice - MENGGUNAKAN CAMELCASE
      const xenditInvoice = await xenditService.createInvoice({
        externalID: `ORDER-${order._id}`,           // camelCase
        amount: total,
        payerEmail: body.customer.email,            // camelCase
        description: `Payment for order ${order._id}`,
        successRedirectURL: `${process.env.APP_URL}/orders/${order._id}/success`,  // camelCase
        failureRedirectURL: `${process.env.APP_URL}/orders/${order._id}/failed`,   // camelCase
        currency: 'IDR',
        items: items.map(item => ({
          name: item.name,
          quantity: item.qty,
          price: item.price,
        })),
      });

      // Update order with Xendit invoice details
      order.payment.providerRef = xenditInvoice.id;
      order.payment.invoiceUrl = xenditInvoice.invoice_url;
      order.payment.status = 'PENDING';
      await order.save();

      return res.status(201).json({
        success: true,
        orderId: order._id,
        invoiceUrl: xenditInvoice.invoice_url,
        invoiceId: xenditInvoice.id,
        amount: total,
        status: 'PENDING',
      });

    } catch (xenditError: any) {
      // Xendit failed, but order is saved
      order.payment.status = 'FAILED';
      order.payment.failureReason = xenditError.message || 'Xendit service unavailable';
      await order.save();

      return res.status(201).json({
        success: true,
        orderId: order._id,
        message: 'Order created but payment initialization failed. Please contact support.',
        status: 'FAILED',
        needsManualPayment: true,
      });
    }

  } catch (error: any) {
    console.error('Checkout error:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    });
  }
}