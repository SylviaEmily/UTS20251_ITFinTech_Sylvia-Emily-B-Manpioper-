// lib/requireAdmin.ts
import type { NextApiRequest, NextApiResponse } from "next";

export function requireAdmin(req: NextApiRequest, res: NextApiResponse): boolean {
  const ADMIN_KEY = process.env.ADMIN_INVITE_KEY;
  
  // Debug logging
  console.log("🔐 requireAdmin check:");
  console.log("  - URL:", req.url);
  console.log("  - ADMIN_KEY exists:", !!ADMIN_KEY);
  console.log("  - ADMIN_KEY value:", ADMIN_KEY ? `${ADMIN_KEY.substring(0, 3)}***` : "none");
  console.log("  - Request header exists:", !!req.headers["x-admin-key"]);
  console.log("  - Request header value:", req.headers["x-admin-key"] ? `${String(req.headers["x-admin-key"]).substring(0, 3)}***` : "none");
  
  if (!ADMIN_KEY) {
    console.error("❌ ADMIN_INVITE_KEY not set in environment");
    res.status(500).json({ message: "Server configuration error: ADMIN_INVITE_KEY not set" });
    return false;
  }

  const providedKey = req.headers["x-admin-key"];
  
  if (!providedKey) {
    console.error("❌ No x-admin-key header in request");
    res.status(401).json({ message: "Unauthorized: Missing admin key" });
    return false;
  }

  if (providedKey !== ADMIN_KEY) {
    console.error("❌ Invalid admin key provided");
    console.error(`   Expected: ${ADMIN_KEY.substring(0, 3)}*** (length: ${ADMIN_KEY.length})`);
    console.error(`   Got: ${String(providedKey).substring(0, 3)}*** (length: ${String(providedKey).length})`);
    res.status(401).json({ message: "Unauthorized: Invalid admin key" });
    return false;
  }

  console.log("✅ Admin authorization successful");
  return true;
}