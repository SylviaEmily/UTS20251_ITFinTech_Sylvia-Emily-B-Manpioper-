// pages/api/admin/orders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { requireAdmin } from "@/lib/requireAdmin";
import OrderModel, { type Order as OrderDoc } from "@/models/Order";
import type { HydratedDocument } from "mongoose";

type OrderStatusQuery = "waiting" | "paid" | "all";
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

// Bentuk respons yang dibutuhkan dashboard
interface ApiOrderRow {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  items: OrderDoc["items"];
  subtotal: number;
  total: number;
  paymentStatus: PaymentStatus;
  invoiceUrl: string;
}

type Success = { data: ApiOrderRow[] };
type Fail = { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Success | Fail>
) {
  if (req.method !== "GET") return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  await dbConnect();

  // Filter status: waiting|paid|all
  const statusQuery = (req.query.status as OrderStatusQuery) || "all";
  const match: Record<string, unknown> = {};
  if (statusQuery === "waiting") match["payment.status"] = "PENDING";
  if (statusQuery === "paid") match["payment.status"] = "PAID";

  // Limit aman 1..200
  const parsed = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 100;

  // Ambil dokumen bertipe jelas (tanpa .lean() agar tidak jatuh ke any)
  const docs: HydratedDocument<OrderDoc>[] = await OrderModel.find(match)
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();

  // Mapping tanpa any
  const data: ApiOrderRow[] = docs.map((o): ApiOrderRow => ({
    _id: String(o._id),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    items: o.items,
    subtotal: o.amounts?.subtotal ?? 0,
    total: o.amounts?.total ?? 0,
    paymentStatus: (o.payment?.status ?? "PENDING") as PaymentStatus,
    invoiceUrl: o.payment?.invoiceUrl ?? "",
  }));

  res.status(200).json({ data });
}
