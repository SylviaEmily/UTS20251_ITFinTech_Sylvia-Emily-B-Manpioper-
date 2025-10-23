import type { NextApiRequest, NextApiResponse } from "next";

export function requireAdmin(req: NextApiRequest, res: NextApiResponse): boolean {
  const key = req.headers["x-admin-key"];
  if (process.env.ADMIN_INVITE_KEY && key === process.env.ADMIN_INVITE_KEY) return true;
  res.status(401).json({ message: "Unauthorized" });
  return false;
}
