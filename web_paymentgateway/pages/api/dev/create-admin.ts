// pages/api/dev/create-admin.ts
import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { Types } from "mongoose";

type UserLean = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  await dbConnect();

  const email = "admin@example.com";

  // ✅ findOne (bukan find) + lean dengan tipe yang eksplisit
  const found = await User.findOne({ email })
    .select("_id")
    .lean<UserLean | null>();

  if (found) {
    return res
      .status(200)
      .json({ message: "Admin already exists", id: found._id.toString() });
  }

  const hashed = await bcrypt.hash("admin123", 10);
  const doc = await User.create({
    name: "Admin Sylvia",
    email,
    phone: "0812345678",
    password: hashed,
    role: "admin",
  });

  return res
    .status(201)
    .json({ message: "Admin created", id: doc._id.toString() });
}
