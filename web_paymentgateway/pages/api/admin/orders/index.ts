// pages/api/admin/orders/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { requireAdmin } from "@/lib/requireAdmin";
import Order from "@/models/Order";

type OrderStatusQuery = "waiting" | "paid" | "all";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  try {
    await dbConnect();

    // status query: waiting|paid|all (default: all)
    const statusQuery = (req.query.status as OrderStatusQuery) || "all";
    const match: Record<string, unknown> = {};

    if (statusQuery === "waiting") match["payment.status"] = "PENDING";
    if (statusQuery === "paid") match["payment.status"] = "PAID";

    const limit = Number(req.query.limit ?? 100);

    // Ambil order terbaru
    const data = await Order.find(match)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Map untuk front-end
    const mapped = data.map(o => ({
      _id: o._id,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      items: o.items || [],
      subtotal: o.amounts?.subtotal ?? 0,
      total: o.amounts?.total ?? 0,
      paymentStatus: o.payment?.status ?? "PENDING",
      invoiceUrl: o.payment?.invoiceUrl ?? "",
    }));

    res.json({ data: mapped });
  } catch (error) {
    console.error("Orders API error:", error);
    res.status(500).json({ 
      message: "Error fetching orders",
      data: []
    });
  }
}