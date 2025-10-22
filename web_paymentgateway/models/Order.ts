import { Schema, model, models, type InferSchemaType } from 'mongoose';

const OrderSchema = new Schema(
  {
    customer: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      address: { type: String, trim: true },
      city: { type: String, trim: true },
      postalCode: { type: String, trim: true },
    },
    items: [
      {
        productId: { type: String, required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        qty: { type: Number, required: true, min: 1 },
        lineTotal: { type: Number, default: 0 }, // tetap ada untuk kompatibilitas
        imageUrl: { type: String, default: '' },
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
      provider: { type: String, enum: ['manual', 'xendit'], default: 'manual' },
      status: {
        type: String,
        enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'],
        default: 'PENDING',
      },
      providerRef: { type: String, default: '' }, // akan diisi inv.id
      invoiceUrl: { type: String, default: '' },  // akan diisi inv.invoice_url
      channel: { type: String, default: '' },
      failureReason: { type: String, default: '' },
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Optional: jaga konsistensi jika lineTotal dipakai tempat lain (tidak memutus flow yang sudah jalan)
OrderSchema.pre('save', function (next) {
  if (this.isModified('items') && Array.isArray(this.items)) {
    this.items.forEach((it: any) => {
      if (typeof it.price === 'number' && typeof it.qty === 'number') {
        it.lineTotal = it.price * it.qty;
      }
    });
  }
  next();
});

export type OrderBase = InferSchemaType<typeof OrderSchema>;
const Order = models.Order || model('Order', OrderSchema);
export default Order;
