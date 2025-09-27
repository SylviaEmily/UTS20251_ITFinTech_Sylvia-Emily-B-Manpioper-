import mongoose, { Document, Schema } from 'mongoose';

export interface OrderBase {
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    postalCode: string;
  };
  items: Array<{
    productId: string;
    name: string;
    price: number;
    qty: number;
    lineTotal: number;
    imageUrl?: string;
  }>;
  amounts: {
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    currency: string;
  };
  payment: {
    provider: 'manual' | 'xendit' | 'midtrans' | 'stripe';
    status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
    providerRef: string;
    invoiceUrl: string;
    channel: string;
    paidAt?: Date;
    failureReason: string;
  };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderDocument extends OrderBase, Document {}

const OrderSchema = new Schema<OrderDocument>(
  {
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
    },
    items: [{
      productId: { type: String, required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      qty: { type: Number, required: true, min: 1 },
      lineTotal: { type: Number, required: true },
      imageUrl: { type: String },
    }],
    amounts: {
      subtotal: { type: Number, required: true },
      tax: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      total: { type: Number, required: true },
      currency: { type: String, default: 'IDR' },
    },
    payment: {
      provider: { 
        type: String, 
        enum: ['manual', 'xendit', 'midtrans', 'stripe'], 
        default: 'xendit' 
      },
      status: { 
        type: String, 
        enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'], 
        default: 'PENDING' 
      },
      providerRef: { type: String, default: '' },
      invoiceUrl: { type: String, default: '' },
      channel: { type: String, default: '' },
      paidAt: { type: Date },
      failureReason: { type: String, default: '' },
    },
    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model<OrderDocument>('Order', OrderSchema);