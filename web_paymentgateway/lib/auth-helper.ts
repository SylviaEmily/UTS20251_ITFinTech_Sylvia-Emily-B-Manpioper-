// lib/auth-helper.ts
import type { NextApiRequest } from "next";
import jwt, { JwtPayload } from "jsonwebtoken";
import User, { IUser } from "@/models/User";

interface DecodedToken extends JwtPayload {
  userId: string;
  role: string;
}

/**
 * Ambil user yang sedang login dari JWT token
 */
export async function getCurrentUser(req: NextApiRequest): Promise<IUser | null> {
  try {
    const token = req.cookies.token;
    if (!token) return null;

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET is not defined");
      return null;
    }

    const decoded = jwt.verify(token, jwtSecret) as DecodedToken;
    const user = await User.findById(decoded.userId);
    
    return user;
  } catch (error) {
    console.error("Failed to get current user:", error);
    return null;
  }
}

/**
 * Middleware-style: ambil user atau throw 401
 */
export async function requireAuth(req: NextApiRequest): Promise<IUser> {
  const user = await getCurrentUser(req);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}