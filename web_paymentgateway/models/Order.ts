import { Schema, model, models } from 'mongoose';

const ItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    name:      { type: String, required: true },
    price:     { type: Number, required: true }, // IDR
    qty:       { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    customer: {
      name: String,
      phone: String,
      address: String,
      city: String,
      postalCode: String,
    },
    items: { type: [ItemSchema], required: true },
    amounts: {
      subtotal: Number,
      tax: Number,
      shipping: Number,
      total: Number, // subtotal + tax + shipping
      currency: { type: String, default: 'IDR' },
    },
    payment: {
      provider: { type: String, enum: ['manual','midtrans','xendit','stripe'], default: 'manual' },
      providerRef: String,
      status: { type: String, enum: ['PENDING','PAID','FAILED','CANCELLED'], default: 'PENDING' },
    },
  },
  { timestamps: true }
);

export default models.Order || model('Order', OrderSchema);
