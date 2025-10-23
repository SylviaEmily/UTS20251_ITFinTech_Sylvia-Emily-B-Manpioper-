// models/Order.ts
import { Schema, model, models, type Model, type InferSchemaType, Types } from "mongoose";

/** Item dalam order */
const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number },
    imageUrl: { type: String, default: "" },
  },
  { _id: false }
);

/** Customer info */
const CustomerSchema = new Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

/** Payment info (dibuat sub-schema supaya bisa default utuh) */
const PaymentSchema = new Schema(
  {
    method: { type: String, default: "xendit" },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "CANCELLED"],
      default: "PENDING",
    },
    invoiceUrl: { type: String, default: "" },
    externalId: { type: String, default: "" },
    paidAt: { type: Date },
  },
  { _id: false }
);

/** Skema Order */
const OrderSchema = new Schema(
  {
    customer: { type: CustomerSchema, default: {} },

    items: { type: [OrderItemSchema], required: true, default: [] },

    amounts: {
      subtotal: { type: Number, required: true, default: 0 },
      tax: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, required: true, default: 0 },
    },

    // 🔴 Penting: pakai PaymentSchema + default supaya tidak pernah undefined
    payment: {
      type: PaymentSchema,
      default: () => ({ method: "xendit", status: "PENDING", invoiceUrl: "", externalId: "" }),
    },

    notes: { type: String, default: "" },
  },
  {
    timestamps: true,
    versionKey: "__v",
  }
);

// Index
OrderSchema.index({ "payment.status": 1, createdAt: -1 });
OrderSchema.index({ "customer.userId": 1 });
OrderSchema.index({ createdAt: -1 });

/** Tipe data */
export type OrderItemBase = InferSchemaType<typeof OrderItemSchema>;
export type CustomerBase = InferSchemaType<typeof CustomerSchema>;
export type PaymentBase = InferSchemaType<typeof PaymentSchema>;
export type OrderBase = InferSchemaType<typeof OrderSchema>;

export type OrderItem = OrderItemBase & { productId: Types.ObjectId };

export type Order = OrderBase & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
  payment: PaymentBase; // 🔒 sekarang selalu ada
};

/** Model */
const OrderModel: Model<Order> =
  (models.Order as Model<Order>) || model<Order>("Order", OrderSchema);

export default OrderModel;
