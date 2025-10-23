// pages/api/auth/verify-otp.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Otp from "@/models/Otp";
import User from "@/models/User";
import jwt from "jsonwebtoken";
import { serialize } from "cookie";
import { normalizePhone } from "@/lib/phone";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { phone, otp } = req.body as { phone: string; otp: string };

  // Normalisasi nomor telepon agar konsisten di DB
  const p = normalizePhone(phone);

  // Ambil OTP terbaru untuk nomor tsb (mempertahankan fungsi lama)
  const record = await Otp.findOne({ phone: p }).sort({ createdAt: -1 });
  if (!record) return res.status(400).json({ message: "OTP not found" });

  // Validasi kode OTP (trim untuk menghindari spasi)
  if (String(record.code).trim() !== String(otp).trim()) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  // Validasi kadaluarsa dengan pembanding waktu yang eksplisit
  if (record.expiresAt.getTime() < Date.now()) {
    return res.status(400).json({ message: "OTP expired" });
  }

  const user = await User.findOne({ phone: p });
  if (!user) return res.status(404).json({ message: "User not found" });

  // ✅ Pastikan JWT_SECRET tersedia
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("Missing JWT_SECRET in environment variables");
    return res.status(500).json({ message: "Server configuration error" });
  }

  const token = jwt.sign(
    { id: user._id.toString(), role: user.role },
    jwtSecret,
    { expiresIn: "2h" }
  );

  // Hapus semua OTP lama untuk nomor tsb (sekali pakai)
  await Otp.deleteMany({ phone: p });

  // Simpan token ke cookie HTTP-only (tambahan dari kode atas)
  const cookie = serialize("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2, // 2 jam
  });
  res.setHeader("Set-Cookie", cookie);

  // Tetap kembalikan token & role seperti fungsi lama agar backward-compatible
  return res.status(200).json({
    message: "Login success",
    token,
    role: user.role,
  });
}
