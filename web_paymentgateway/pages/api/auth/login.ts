import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Otp from "@/models/Otp";
import bcrypt from "bcryptjs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { emailOrPhone, password } = req.body;

  const user = await User.findOne({
    $or: [{ email: emailOrPhone }, { phone: emailOrPhone }],
  });

  if (!user) return res.status(404).json({ message: "User not found" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: "Invalid password" });

  // Buat OTP baru
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

  // HAPUS OTP lama untuk nomor ini agar tidak bentrok
  await Otp.deleteMany({ phone: user.phone });

  // Simpan OTP terbaru
  await Otp.create({ phone: user.phone, code: otpCode, expiresAt });

  // Kirim via Fonnte
  const fonnteToken = process.env.FONNTE_TOKEN ?? "";
  if (!fonnteToken) {
    console.error("FONNTE_TOKEN is missing in .env");
    return res.status(500).json({ message: "Server config error" });
  }

  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: fonnteToken,
      "Content-Type": "application/json",
    } as HeadersInit,
    body: JSON.stringify({
      target: user.phone,
      message: `Kode OTP login kamu adalah *${otpCode}*. Berlaku 5 menit.`,
    }),
  });

  if (!response.ok) {
    console.error("Failed to send WhatsApp OTP");
    return res.status(500).json({ message: "Failed to send OTP" });
  }

  return res.status(200).json({ message: "OTP sent", phone: user.phone });
}
