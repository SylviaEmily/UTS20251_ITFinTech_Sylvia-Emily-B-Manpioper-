// pages/api/auth/verify-otp.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Otp from "@/models/Otp";
import User from "@/models/User";
import jwt from "jsonwebtoken";
import { serialize } from "cookie";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { phone, otp } = req.body as { phone?: string; otp?: string };

  // validasi minimal
  if (!phone || !otp) {
    return res.status(400).json({ message: "Phone & OTP are required" });
  }

  const record = await Otp.findOne({ phone }).sort({ createdAt: -1 });
  if (!record) return res.status(400).json({ message: "OTP not found" });
  if (record.code !== otp) return res.status(400).json({ message: "Invalid OTP" });
  if (record.expiresAt < new Date()) return res.status(400).json({ message: "OTP expired" });

  const user = await User.findOne({ phone });
  if (!user) return res.status(404).json({ message: "User not found" });

  // Pastikan secret ada
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("Missing JWT_SECRET in environment variables");
    return res.status(500).json({ message: "Server configuration error" });
  }

  // Buat JWT
  const token = jwt.sign(
    { id: user._id.toString(), role: user.role },
    jwtSecret,
    { expiresIn: "2h" }
  );

  // Hapus OTP lama supaya tidak bisa dipakai ulang
  await Otp.deleteMany({ phone });

  // ✅ Set cookie HttpOnly di SERVER
  const isProd = process.env.NODE_ENV === "production";
  res.setHeader(
    "Set-Cookie",
    serialize("token", token, {
      httpOnly: true,
      secure: isProd,         // true di production (HTTPS)
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 2,    // 2 jam
    })
  );

  // Tidak perlu mengembalikan token ke client—cukup role untuk redirect
  return res.status(200).json({
    message: "Login success",
    role: user.role,
  });
}
