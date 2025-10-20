import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  await dbConnect();

  const { name, email, phone, password } = req.body as {
    name: string; email: string; phone?: string; password: string;
  };

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: "Email already used" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, phone, password: hashed });

  // agar tidak mengembalikan hash
  const { password: _, ...safe } = user.toObject();
  return res.status(201).json({ message: "User registered", user: safe });
}
