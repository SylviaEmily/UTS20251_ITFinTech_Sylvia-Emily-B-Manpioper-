// pages/api/auth/me.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? '';

type MeResponse =
  | { authenticated: false }
  | { authenticated: true; role: string };

type AppJwtPayload = JwtPayload & { role?: string };

function hasRole(payload: string | JwtPayload): payload is AppJwtPayload {
  return typeof payload === 'object' && payload !== null && 'role' in payload;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MeResponse>
) {
  // Secret tidak ter-set → treat seperti tidak autentik
  if (!JWT_SECRET) {
    return res.status(401).json({ authenticated: false });
  }

  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ authenticated: false });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!hasRole(decoded) || !decoded.role) {
      return res.status(401).json({ authenticated: false });
    }

    return res.status(200).json({ authenticated: true, role: decoded.role });
  } catch {
    return res.status(401).json({ authenticated: false });
  }
}
