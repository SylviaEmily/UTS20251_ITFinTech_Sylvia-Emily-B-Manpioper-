// pages/api/admin/products/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { requireAdmin } from "@/lib/requireAdmin";
import ProductModel from "@/models/product";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;
  await dbConnect();

  const { id } = req.query as { id: string };

  try {
    if (req.method === "PATCH") {
      // Support partial updates (like toggling isActive)
      const updated = await ProductModel.findByIdAndUpdate(
        id, 
        req.body, 
        { new: true, runValidators: true }
      ).lean();
      
      if (!updated) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.json({ data: updated });
    }

    if (req.method === "PUT") {
      // Full update
      const updated = await ProductModel.findByIdAndUpdate(
        id, 
        req.body, 
        { new: true, runValidators: true }
      ).lean();
      
      if (!updated) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      return res.json({ data: updated });
    }

    if (req.method === "DELETE") {
      const deleted = await ProductModel.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ message: "Product not found" });
      }
      return res.status(204).end();
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error("Product API error:", error);
    return res.status(500).json({ 
      message: error instanceof Error ? error.message : "Internal server error" 
    });
  }
}