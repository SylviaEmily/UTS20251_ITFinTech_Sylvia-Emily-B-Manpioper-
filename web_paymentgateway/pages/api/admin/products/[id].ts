import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { requireAdmin } from "@/lib/requireAdmin";
import ProductModel from "@/models/product";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;
  await dbConnect();

  const { id } = req.query as { id: string };

  if (req.method === "PUT") {
    const updated = await ProductModel.findByIdAndUpdate(id, req.body, { new: true }).lean();
    return res.json({ data: updated });
  }
  if (req.method === "DELETE") {
    await ProductModel.findByIdAndDelete(id);
    return res.status(204).end();
  }

  return res.status(405).end();
}
