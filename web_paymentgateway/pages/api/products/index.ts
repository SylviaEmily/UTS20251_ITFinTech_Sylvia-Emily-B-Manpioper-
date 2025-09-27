import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';
import Product from '@/models/product';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    const { category } = req.query;
    const q: any = { isActive: true };
    if (category && typeof category === 'string' && category !== 'All') q.category = category;
    const products = await Product.find(q).sort({ createdAt: -1 });
    return res.status(200).json(products);
  }

  if (req.method === 'POST') {
    // untuk admin/seed sederhana
    const doc = await Product.create(req.body);
    return res.status(201).json(doc);
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
