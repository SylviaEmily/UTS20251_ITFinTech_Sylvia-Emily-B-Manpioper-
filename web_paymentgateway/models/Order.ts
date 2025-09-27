// models/order.ts
import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
  Types,
} from 'mongoose';

/** Subdocument: Item */
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

/** Order */
const OrderSchema = new Schema(
  {
    customer: {
      name:       { type: String },
      phone:      { type: String },
      address:    { type: String },
      city:       { type: String },
      postalCode: { type: String },
    },
    items: { type: [ItemSchema], required: true },
    amounts: {
      subtotal: { type: Number },
      tax:      { type: Number },
      shipping: { type: Number },
      total:    { type: Number }, // subtotal + tax + shipping
      currency: { type: String, default: 'IDR' },
    },
    payment: {
      provider:    { type: String, enum: ['manual','midtrans','xendit','stripe'], default: 'manual' },
      providerRef: { type: String },
      status:      { type: String, enum: ['PENDING','PAID','FAILED','CANCELLED'], default: 'PENDING' },
    },
  },
  { timestamps: true }
);

/** (Opsional) index yang umum dipakai untuk query */
OrderSchema.index({ 'payment.status': 1, createdAt: -1 });

/** Tipe turunan dari skema (tanpa any) */
export type OrderItem = InferSchemaType<typeof ItemSchema>;
export type OrderBase = InferSchemaType<typeof OrderSchema>;
export type Order = OrderBase & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

/** Model */
const OrderModel: Model<Order> =
  (models.Order as Model<Order>) || model<Order>('Order', OrderSchema);

export default OrderModel;
