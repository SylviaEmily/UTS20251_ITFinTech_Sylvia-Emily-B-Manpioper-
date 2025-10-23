// pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

/** Normalisasi nomor WA: 08xxxx → 628xxxx, +62 → 62 */
function normalizePhone(input: string) {
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
      role,       // "user" | "admin" (opsional dari client)
      adminKey,   // kunci undangan admin (opsional)
    } = req.body as {
      name: string;
      email: string;
      phone?: string;
      password: string;
      confirmPassword?: string;
      role?: "user" | "admin";
      adminKey?: string;
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
    const lowerEmail = email.toLowerCase().trim();

    // Cek duplikat by email/phone
    const existing = await User.findOne({
      $or: [{ email: lowerEmail }, { phone: normalizedPhone }],
    });
    if (existing) {
      return res.status(400).json({ message: "Email atau nomor sudah digunakan" });
    }

    // ===== TENTUKAN ROLE DI SERVER =====
    let finalRole: "user" | "admin" = "user";
    if (role === "admin") {
      if (!ADMIN_INVITE_KEY) {
        return res
          .status(500)
          .json({ message: "Server belum dikonfigurasi ADMIN_INVITE_KEY" });
      }
      if (adminKey !== ADMIN_INVITE_KEY) {
        return res.status(403).json({ message: "Admin key tidak valid" });
      }
      finalRole = "admin";
    }

    // ===== HASH PASSWORD & SIMPAN =====
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: lowerEmail,
      phone: normalizedPhone,
      password: hashed,
      role: finalRole, // ← default user, atau admin bila key valid
    });

    // Hapus password dari response
    const { password: _pw, ...safe } = user.toObject();
    delete (safe as any).password;

    return res.status(201).json({ message: "Registrasi berhasil", user: safe });
  } catch (err: any) {
    console.error(err);
    // Handle duplicate key dari unique index
    if (err?.code === 11000) {
      return res.status(400).json({ message: "Email atau nomor sudah digunakan" });
    }
    return res.status(500).json({ message: "Kesalahan server" });
  }
}
