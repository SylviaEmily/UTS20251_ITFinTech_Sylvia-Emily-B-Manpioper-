// models/product.ts
import { Schema, model, models, type Model, type InferSchemaType, Types } from 'mongoose';

/** Skema Product */
const ProductSchema = new Schema(
  {
    name:        { type: String, required: true },
    price:       { type: Number, required: true }, // IDR
    description: { type: String, default: '' },
    imageUrl:    { type: String, default: '' },    // ex: /images/coffee.jpg atau URL CDN
    category:    { type: String, default: 'All' }, // contoh: Drinks/Snacks/Bundle/All
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

/** Tipe data (tanpa any) */
export type ProductBase = InferSchemaType<typeof ProductSchema>;
export type Product = ProductBase & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

/** Model */
const ProductModel: Model<Product> =
  (models.Product as Model<Product>) || model<Product>('Product', ProductSchema);

export default ProductModel;
