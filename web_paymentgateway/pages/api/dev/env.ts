// pages/api/dev/env.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    has_MONGODB_URI: !!process.env.MONGODB_URI,
    has_JWT_SECRET: !!process.env.JWT_SECRET,
    node_env: process.env.NODE_ENV ?? 'development',
  });
}
