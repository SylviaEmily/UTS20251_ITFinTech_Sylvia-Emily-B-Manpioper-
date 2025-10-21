// pages/api/auth/me.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ authenticated: false });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return res.status(200).json({ authenticated: true, role: payload.role });
  } catch {
    return res.status(401).json({ authenticated: false });
  }
}
