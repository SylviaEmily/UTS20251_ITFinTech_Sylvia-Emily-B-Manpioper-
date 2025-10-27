// pages/api/admin/orders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { requireAdmin } from "@/lib/requireAdmin";
import OrderModel from "@/models/Order";
import { isValidObjectId, Types } from "mongoose";

type OrderStatusQuery = "waiting" | "paid" | "all";
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

// Struktur yang diharapkan dashboard
interface ApiOrderRow {
  _id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  invoiceUrl: string;
}

type Success = { data: ApiOrderRow[]; nextCursor?: string | null };
type Fail = { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Success | Fail>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!requireAdmin(req, res)) return;

  try {
    await dbConnect();

    // --- filter status: waiting | paid | all
    const qStatus = String(req.query.status ?? "all") as OrderStatusQuery;
    const match: Record<string, unknown> = {};
    if (qStatus === "waiting") match["payment.status"] = "PENDING";
    else if (qStatus === "paid") match["payment.status"] = "PAID";

    // --- limit aman 1..200
    const rawLimit = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200)
      : 100;

    // --- optional: cursor pagination (?cursor=<_id>), ambil dokumen "sebelum" cursor
    const cursorParam = typeof req.query.cursor === "string" ? req.query.cursor : null;
    if (cursorParam && isValidObjectId(cursorParam)) {
      match._id = { $lt: new Types.ObjectId(cursorParam) };
    }

    // --- ambil dokumen dengan projection secukupnya
    const docs = await OrderModel.find(
      match,
      {
        _id: 1,
        "customer.userId": 1,
        createdAt: 1,
        updatedAt: 1,
        items: 1,
        amounts: 1,
        payment: 1,
      }
    )
      .sort({ _id: -1 })          // gunakan _id untuk pagination stabil
      .limit(limit + 1)           // ambil 1 ekstra untuk lihat "hasMore"
      .lean()
      .exec();

    const hasMore = docs.length > limit;
    const slice = hasMore ? docs.slice(0, limit) : docs;

    const data: ApiOrderRow[] = slice.map((o: any): ApiOrderRow => ({
      _id: String(o._id),
      userId: String(o?.customer?.userId ?? o._id),
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      items: (o.items ?? []).map((item: any) => ({
        productId: String(item.productId),
        name: item.name,
        // konsisten dgn orders.ts (qty), tapi tetap aman kalau ada field "quantity"
        quantity: Number(item.qty ?? item.quantity ?? 0),
        price: Number(item.price ?? 0),
      })),
      totalAmount: Number(o?.amounts?.total ?? 0),
      paymentStatus: (o?.payment?.status ?? "PENDING") as PaymentStatus,
      invoiceUrl: String(o?.payment?.invoiceUrl ?? ""),
    }));

    // nextCursor untuk “Load more” di dashboard
    const nextCursor = hasMore ? String(slice[slice.length - 1]._id) : null;

    return res.status(200).json({ data, nextCursor });
  } catch (error: any) {
    console.error("Orders API error:", error);
    return res.status(500).json({
      message: error?.message ?? "Error fetching orders",
    });
  }
}
