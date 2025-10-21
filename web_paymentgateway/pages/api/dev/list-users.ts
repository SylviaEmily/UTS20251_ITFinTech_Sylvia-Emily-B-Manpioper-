// pages/api/dev/list-users.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import User from '../../../models/User';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();
  const users = await User.find({}, { email: 1, role: 1, passwordHash: 1 }).lean();
  // jangan kirim hash penuh ke UI; cukup panjangnya agar tahu ada/tidak
  const safe = users.map(u => ({
    email: u.email,
    role: u.role,
    hasPasswordHash: Boolean(u.passwordHash),
    passwordHashLen: u.passwordHash ? String(u.passwordHash).length : 0,
  }));
  res.status(200).json(safe);
}
