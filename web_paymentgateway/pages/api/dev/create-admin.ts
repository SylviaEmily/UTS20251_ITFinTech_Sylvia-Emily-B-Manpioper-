// pages/api/dev/create-admin.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email = 'admin@example.com', password = 'admin123' } = req.body ?? {};
  try {
    await dbConnect();
    const passwordHash = await bcrypt.hash(String(password), 10);
    const admin = await User.findOneAndUpdate(
      { email },
      { email, name: 'Admin', role: 'admin', passwordHash },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ ok: true, email: admin.email });
  } catch (e:any) {
    res.status(500).json({ ok: false, error: e?.message || 'error' });
  }
}
