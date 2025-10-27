// pages/api/admin/orders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { requireAdmin } from "@/lib/requireAdmin";
import OrderModel, { type Order as OrderDoc } from "@/models/Order";
import type { HydratedDocument } from "mongoose";

type OrderStatusQuery = "waiting" | "paid" | "all";
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

/** Item yang dikirim ke UI (punya alias quantity) */
type UiOrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number; // alias dari qty
  // biarkan properti lain ikut jika ada
  [k: string]: unknown;
};

/** Bentuk respons yang dibutuhkan dashboard */
interface ApiOrderRow {
  _id: string;
  userId: string;       // <-- UI pakai ini
  items: UiOrderItem[]; // <-- items[].quantity dipakai UI
  totalAmount: number;  // <-- UI pakai ini
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

type Success = { data: ApiOrderRow[] };
type Fail = { message: string };

// ---------- helpers ----------
const toNumber = (v: unknown, fallback = 0): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

const toStringSafe = (v: unknown, fallback = ""): string =>
  v === undefined || v === null ? fallback : String(v);

const isObjWithToObject = (x: unknown): x is { toObject: () => unknown } =>
  typeof x === "object" &&
  x !== null &&
  "toObject" in x &&
  typeof (x as Record<string, unknown>).toObject === "function";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Success | Fail>
) {
  if (req.method !== "GET") return res.status(405).end();
  if (!requireAdmin(req, res)) return;

  await dbConnect();

  const statusQuery = (req.query.status as OrderStatusQuery) || "all";
  const match: Record<string, unknown> = {};
  if (statusQuery === "waiting") match["payment.status"] = "PENDING";
  if (statusQuery === "paid") match["payment.status"] = "PAID";

  const parsed = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 100;

  const docs: HydratedDocument<OrderDoc>[] = await OrderModel.find(match)
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();

  // 👉 Mapping dengan alias supaya cocok dengan UI
  const data: ApiOrderRow[] = docs.map((o) => {
    const items: UiOrderItem[] = o.items.map((it: unknown) => {
      // pastikan plain object dulu, lalu tambahkan alias quantity
      const base: Record<string, unknown> = isObjWithToObject(it)
        ? (it.toObject() as Record<string, unknown>)
        : typeof it === "object" && it !== null
        ? { ...(it as Record<string, unknown>) }
        : {};

      return {
        ...base, // biarkan properti lain ikut jika ada
        productId: toStringSafe(base.productId, ""),
        name: toStringSafe(base.name, ""),
        price: toNumber(base.price, 0),
        quantity: toNumber(
          base.qty !== undefined ? base.qty : base.quantity,
          1
        ), // alias dari qty
      };
    });

    return {
      _id: String(o._id),
      userId: o.customer?.userId ? String(o.customer.userId) : "-", // UI tampilkan userId; fallback "-"
      items,
      totalAmount: o.amounts?.total ?? 0, // alias amounts.total
      paymentStatus: (o.payment?.status ?? "PENDING") as PaymentStatus,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    };
  });

  res.status(200).json({ data });
}
