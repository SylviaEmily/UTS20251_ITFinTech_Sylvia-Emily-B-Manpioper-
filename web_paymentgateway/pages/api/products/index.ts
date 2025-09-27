// pages/api/products/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import ProductModel, { type Product, type ProductBase } from '@/models/product';

type ProductFilter = {
  isActive?: boolean;
  category?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await dbConnect();

    if (req.method === 'GET') {
      const { category } = req.query;

      const filter: ProductFilter = { isActive: true };
      if (typeof category === 'string' && category !== 'All') {
        filter.category = category;
      }

      const products: Product[] = await ProductModel.find(filter)
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json(products);
    }

    if (req.method === 'POST') {
      // seed/admin sederhana
      const payload = req.body as ProductBase;
      const doc: Product = await ProductModel.create(payload);
      return res.status(201).json(doc);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: 'Method not allowed' });
  } catch (err) {
    console.error('API /products error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
