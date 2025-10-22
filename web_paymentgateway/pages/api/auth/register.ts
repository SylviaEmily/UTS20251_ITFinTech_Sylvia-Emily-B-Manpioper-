// pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

/** Normalisasi nomor WA: 08xxxx → 628xxxx, +62 → 62 */
function normalizePhone(input: string) {
  let p = input.replace(/\D/g, "");
  if (p.startsWith("08")) p = "62" + p.slice(1);
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("+62")) p = p.replace("+", "");
  return p;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  await dbConnect();

  const { name, email, phone, password, confirmPassword } = req.body as {
    name: string;
    email: string;
    phone?: string;
    password: string;
    confirmPassword?: string;
  };

  // ===== VALIDASI INPUT =====
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: "Semua field wajib diisi" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password minimal 6 karakter" });
  }

  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).json({ message: "Konfirmasi password tidak cocok" });
  }

  const normalizedPhone = normalizePhone(phone);
  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { phone: normalizedPhone }],
  });

  if (existing) {
    return res.status(400).json({ message: "Email atau nomor sudah digunakan" });
  }

  // ===== HASH PASSWORD =====
  const hashed = await bcrypt.hash(password, 10);

  // ===== SIMPAN USER BARU =====
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    phone: normalizedPhone,
    password: hashed,
    role: "user", // default
  });

  // Hapus password dari response tanpa trigger ESLint
  const { password: pw, ...safe } = user.toObject();
  delete safe.password;

  return res.status(201).json({ message: "Registrasi berhasil", user: safe });
}
