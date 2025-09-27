import {
  Schema, model, models, type Model, type InferSchemaType, Types,
} from 'mongoose';

const ItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    name:      { type: String, required: true },
    price:     { type: Number, required: true, min: 0 },
    qty:       { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
    // jika mau simpan gambar, buka baris ini lalu konsisten di API:
    // imageUrl:  { type: String, default: '' },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    customer: {
      name:       { type: String, trim: true },
      phone:      { type: String, trim: true },
      address:    { type: String, trim: true },
      city:       { type: String, trim: true },
      postalCode: { type: String, trim: true },
      email:      { type: String, trim: true },
    },
    items: {
      type: [ItemSchema],
      required: true,
      validate: {
        validator: (v: Array<Record<string, unknown>>) => Array.isArray(v) && v.length > 0,
        message: 'Order harus memiliki minimal 1 item',
      },
    },
    amounts: {
      subtotal: { type: Number, required: true, min: 0 },
      tax:      { type: Number, required: true, min: 0 },
      shipping: { type: Number, required: true, min: 0, default: 0 },
      total:    { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'IDR' },
    },
    payment: {
      provider:     { type: String, enum: ['manual','midtrans','xendit','stripe'], default: 'manual' },
      providerRef:  { type: String, default: '' }, // invoice id dari provider
      status:       { type: String, enum: ['PENDING','PAID','FAILED','CANCELLED'], default: 'PENDING' },
      invoiceUrl:   { type: String, default: '' },
      channel:      { type: String, default: '' },
      paidAt:       { type: Date },
      failureReason:{ type: String, default: '' },
    },
  },
  { timestamps: true }
);

OrderSchema.index({ 'payment.status': 1, createdAt: -1 });
OrderSchema.index({ 'payment.providerRef': 1 }, { sparse: true });

export type OrderItem = InferSchemaType<typeof ItemSchema>;
export type OrderBase = InferSchemaType<typeof OrderSchema>;
export type Order = OrderBase & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date; };

const OrderModel: Model<Order> = (models.Order as Model<Order>) || model<Order>('Order', OrderSchema);
export default OrderModel;
