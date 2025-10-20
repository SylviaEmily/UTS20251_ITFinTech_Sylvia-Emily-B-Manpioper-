import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    await dbConnect();
    const users = await User.find({}).select("-password").limit(50).lean();
    return res.status(200).json({ count: users.length, users });
  } catch (err: any) {
    console.error("list-users error:", err);
    return res.status(500).json({ message: err.message || "Internal error" });
  }
}
