import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { requireAdmin } from "@/lib/requireAdmin";
import Order from "@/models/Order";

/**
 * Catatan: pakai updatedAt sebagai proxy kapan jadi PAID.
 * Kalau nanti ada field paidAt, cukup ganti "updatedAt" -> "paidAt".
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  await dbConnect();

  // Hanya order PAID dihitung omzet
  const match = { "payment.status": "PAID" };

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
    daily: daily.map(d => ({ date: d._id, total: d.total })),
    monthly: monthly.map(m => ({ month: m._id, total: m.total })),
  });
}
