import { Schema, model, models, type InferSchemaType } from 'mongoose';

const OrderSchema = new Schema(
  {
    customer: {
      name: String,
      phone: String,
      email: String,
      address: String,
      city: String,
      postalCode: String,
    },
    items: [
      {
        productId: String,
        name: String,
        price: Number,
        qty: Number,
        lineTotal: Number,
        imageUrl: String,
      },
    ],
    amounts: {
      subtotal: { type: Number, required: true },
      tax: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      total: { type: Number, required: true },
      currency: { type: String, default: 'IDR' },
    },
    payment: {
      provider: { type: String, default: 'manual' }, // 'xendit'
      status: { type: String, default: 'PENDING' },  // PENDING|PAID|FAILED|CANCELLED
      providerRef: { type: String, default: '' },
      invoiceUrl: { type: String, default: '' },
      channel: { type: String, default: '' },
      failureReason: { type: String, default: '' },
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export type OrderBase = InferSchemaType<typeof OrderSchema>;
const OrderModel = models.Order || model('Order', OrderSchema);
export default OrderModel;
