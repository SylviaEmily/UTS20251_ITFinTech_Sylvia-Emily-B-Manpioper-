import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { requireAdmin } from "@/lib/requireAdmin";
import ProductModel from "@/models/product";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;
  await dbConnect();

  if (req.method === "GET") {
    const data = await ProductModel.find().sort({ createdAt: -1 }).lean();
    return res.json({ data });
  }

  if (req.method === "POST") {
    const { name, price, description, imageUrl, category, isActive } = req.body;
    if (!name || price == null) return res.status(400).json({ message: "Nama & harga wajib" });

    const created = await ProductModel.create({
      name, price, description, imageUrl, category, isActive: isActive ?? true,
    });

    return res.status(201).json({ data: created });
  }

  return res.status(405).end();
}
