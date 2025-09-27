import { Schema, model, models } from 'mongoose';

const OrderSchema = new Schema(
  {
    customer: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
    },
    items: [
      {
        sku: String,
        name: String,
        qty: Number,
        price: Number, // per item (IDR integer)
        total: Number, // qty * price
      },
    ],
    amounts: {
      subtotal: { type: Number, required: true },
      tax: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      total: { type: Number, required: true }, // IDR integer
    },
    payment: {
      provider: { type: String, default: 'manual' }, // 'xendit'
      providerRef: { type: String, default: '' },     // invoice id
      status: { type: String, default: 'PENDING' },   // PENDING|PAID|FAILED|CANCELLED
    },
  },
  { timestamps: true }
);

export default models.Order || model('Order', OrderSchema);
