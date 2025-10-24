// pages/api/admin/stats.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { requireAdmin } from "@/lib/requireAdmin";
import OrderModel from "@/models/Order";

type DailyAgg = { _id: string; total: number };
type MonthlyAgg = { _id: string; total: number };
type Status = "PAID" | "PENDING" | "ALL";

function parseStatus(q: unknown): Status {
  const s = typeof q === "string" ? q.toUpperCase() : "PAID";
  return s === "ALL" ? "ALL" : s === "PENDING" ? "PENDING" : "PAID";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  try {
    await dbConnect();

    // Default: PAID. Bisa override lewat ?status=PAID|PENDING|ALL
    const status = parseStatus(req.query.status);
    const match = status === "ALL" ? {} : { "payment.status": status as Exclude<Status, "ALL"> };

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

    const daily = dailyAgg.map((d) => ({ date: d._id, total: d.total ?? 0 }));
    const monthly = monthlyAgg.map((m) => ({ month: m._id, total: m.total ?? 0 }));

    res.json({ daily, monthly });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Stats API error:", message);
    res.status(500).json({ message: "Error generating stats", daily: [], monthly: [] });
  }
}
