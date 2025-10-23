// pages/api/admin/stats.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { requireAdmin } from "@/lib/requireAdmin";
import Order from "@/models/Order";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  try {
    await dbConnect();

    // Match PAID orders only
    const match = { "payment.status": "PAID" };

    // Daily stats
    const daily = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { date: "$updatedAt", format: "%Y-%m-%d" } },
          total: { $sum: "$amounts.total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Monthly stats
    const monthly = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { date: "$updatedAt", format: "%Y-%m" } },
          total: { $sum: "$amounts.total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      daily: daily.map(d => ({ date: d._id, total: d.total || 0 })),
      monthly: monthly.map(m => ({ month: m._id, total: m.total || 0 })),
    });
  } catch (error) {
    console.error("Stats API error:", error);
    res.status(500).json({ 
      message: "Error generating stats",
      daily: [],
      monthly: []
    });
  }
}