import { Schema, model, models } from 'mongoose';

const ProductSchema = new Schema(
  {
    name:        { type: String, required: true },
    price:       { type: Number, required: true }, // IDR
    description: { type: String, default: '' },
    imageUrl:    { type: String, default: '' },    // ex: /images/coffee.jpg atau URL CDN
    category:    { type: String, default: 'All' }, // Drinks/Snacks/Bundle/All
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type ProductDoc = typeof ProductSchema extends infer T ? any : any;
export default models.Product || model('Product', ProductSchema);
