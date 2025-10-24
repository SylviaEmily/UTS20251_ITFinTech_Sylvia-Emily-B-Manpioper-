// pages/api/admin/stats.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { requireAdmin } from "@/lib/requireAdmin";
import OrderModel from "@/models/Order"; // ⬅️ pakai nama jelas agar tak bentrok

type DailyAgg = { _id: string; total: number };
type MonthlyAgg = { _id: string; total: number };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  try {
    await dbConnect();

    // Hanya order berstatus PAID yang dihitung omzet
    const match = { "payment.status": "PAID" } as const;

    // --- Daily (YYYY-MM-DD)
    const dailyAgg = await OrderModel.aggregate<DailyAgg>([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { date: "$updatedAt", format: "%Y-%m-%d" } },
          total: { $sum: "$amounts.total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // --- Monthly (YYYY-MM)
    const monthlyAgg = await OrderModel.aggregate<MonthlyAgg>([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { date: "$updatedAt", format: "%Y-%m" } },
          total: { $sum: "$amounts.total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const daily = dailyAgg.map((d: DailyAgg) => ({ date: d._id, total: d.total ?? 0 }));
    const monthly = monthlyAgg.map((m: MonthlyAgg) => ({ month: m._id, total: m.total ?? 0 }));

    res.json({ daily, monthly });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Stats API error:", message);
    res.status(500).json({ message: "Error generating stats", daily: [], monthly: [] });
  }
}
