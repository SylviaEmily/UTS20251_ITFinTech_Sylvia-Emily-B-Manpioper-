// pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

/** Normalisasi nomor WA: 08xxxx → 628xxxx, +62 → 62 */
function normalizePhone(input: string): string {
  let p = (input || "").replace(/\D/g, "");
  if (p.startsWith("08")) p = "62" + p.slice(1);
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("+62")) p = p.replace("+", "");
  return p;
}

const ADMIN_INVITE_KEY = process.env.ADMIN_INVITE_KEY; // 🔐 set di .env

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await dbConnect();

    const {
      name,
      email,
      phone,
      password,
      confirmPassword,
      role,
      adminKey,
    }: {
      name: string;
      email: string;
      phone?: string;
      password: string;
      confirmPassword?: string;
      role?: "user" | "admin";
      adminKey?: string;
    } = req.body;

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
    const lowerEmail = email.toLowerCase().trim();

    // Cek duplikat email/phone
    const existing = await User.findOne({
      $or: [{ email: lowerEmail }, { phone: normalizedPhone }],
    });
    if (existing) {
      return res.status(400).json({ message: "Email atau nomor sudah digunakan" });
    }

    // ===== TENTUKAN ROLE =====
    let finalRole: "user" | "admin" = "user";
    if (role === "admin") {
      if (!ADMIN_INVITE_KEY) {
        return res.status(500).json({
          message: "Server belum dikonfigurasi ADMIN_INVITE_KEY",
        });
      }
      if (adminKey !== ADMIN_INVITE_KEY) {
        return res.status(403).json({ message: "Admin key tidak valid" });
      }
      finalRole = "admin";
    }

    // ===== HASH PASSWORD =====
    const hashed = await bcrypt.hash(password, 10);

    // ===== SIMPAN USER BARU =====
    const user = await User.create({
      name: name.trim(),
      email: lowerEmail,
      phone: normalizedPhone,
      password: hashed,
      role: finalRole,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _ignored, ...safeUser } = user.toObject() as Record<string, unknown>;
    // hapus password secara eksplisit tanpa pakai any
    delete safeUser.password;

    return res.status(201).json({ message: "Registrasi berhasil", user: safeUser });
  } catch (err) {
    console.error(err);
    if (typeof err === "object" && err && "code" in err && (err as { code: number }).code === 11000) {
      return res.status(400).json({ message: "Email atau nomor sudah digunakan" });
    }
    return res.status(500).json({ message: "Kesalahan server" });
  }
}
