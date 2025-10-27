// pages/api/admin/orders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { requireAdmin } from "@/lib/requireAdmin";
import OrderModel from "@/models/Order";
import { isValidObjectId, Types } from "mongoose";

type OrderStatusQuery = "waiting" | "paid" | "all";
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

// ---------- Bentuk data minimal dari koleksi (hasil .lean()) ----------
type RawOrderItem = {
  productId?: string | number;
  name?: string;
  price?: number | string;
  qty?: number | string;
  quantity?: number | string;
  [k: string]: unknown;
};

type OrderLeanDoc = {
  _id: Types.ObjectId;
  customer?: { userId?: string | number } | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  items?: RawOrderItem[];
  amounts?: { total?: number | string } | null;
  payment?: { status?: PaymentStatus; invoiceUrl?: string } | null;
};

// ---------- Struktur respons untuk dashboard ----------
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
  // --- dukung preflight CORS jika perlu
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ message: "Method not allowed" });
  }

  // pastikan hanya admin
  if (!requireAdmin(req, res)) return;

  try {
    await dbConnect();

    // --- filter status: waiting | paid | all  (dengan normalisasi)
    const rawStatus = String(req.query.status ?? "all").toLowerCase();
    const qStatus: OrderStatusQuery =
      rawStatus === "waiting" || rawStatus === "paid" ? rawStatus : "all";

    const match: Record<string, unknown> = {};
    if (qStatus === "waiting") match["payment.status"] = "PENDING";
    else if (qStatus === "paid") match["payment.status"] = "PAID";

    // --- limit aman 1..200
    const rawLimit = Number(req.query.limit ?? 100);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.trunc(rawLimit), 200)
        : 100;

    // --- optional: cursor pagination (?cursor=<_id>), ambil dokumen "sebelum" cursor
    const cursorParam = typeof req.query.cursor === "string" ? req.query.cursor : null;
    if (cursorParam && isValidObjectId(cursorParam)) {
      match._id = { $lt: new Types.ObjectId(cursorParam) };
    }

    // --- ambil dokumen dengan projection secukupnya
    const docs: OrderLeanDoc[] = await OrderModel.find(match, {
      _id: 1,
      "customer.userId": 1,
      createdAt: 1,
      updatedAt: 1,
      items: 1,
      amounts: 1,
      payment: 1,
    })
      .sort({ _id: -1 }) // gunakan _id untuk pagination stabil
      .limit(limit + 1) // ambil 1 ekstra untuk lihat "hasMore"
      .lean<OrderLeanDoc[]>()
      .exec();

    const hasMore = docs.length > limit;
    const slice = hasMore ? docs.slice(0, limit) : docs;

    // util konversi
    const toNumber = (v: unknown, fallback = 0): number => {
      if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
      if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      }
      return fallback;
    };

    const toDate = (v: Date | string): Date => (v instanceof Date ? v : new Date(v));

    const data: ApiOrderRow[] = slice.map((o): ApiOrderRow => {
      const itemsArr = Array.isArray(o.items) ? o.items : [];

      const items = itemsArr.map((item) => {
        const productId = String(item.productId ?? "");
        const name = String(item.name ?? "");
        const price = toNumber(item.price, 0);
        const quantity = toNumber(
          item.qty !== undefined ? item.qty : item.quantity,
          0
        );
        return { productId, name, price, quantity };
      });

      return {
        _id: String(o._id),
        userId: String(o?.customer?.userId ?? o._id),
        createdAt: toDate(o.createdAt),
        updatedAt: toDate(o.updatedAt),
        items,
        totalAmount: toNumber(o?.amounts?.total, 0),
        paymentStatus: (o?.payment?.status ?? "PENDING") as PaymentStatus,
        invoiceUrl: String(o?.payment?.invoiceUrl ?? ""),
      };
    });

    // nextCursor untuk “Load more” di dashboard
    const nextCursor = hasMore ? String(slice[slice.length - 1]._id) : null;

    return res.status(200).json({ data, nextCursor });
  } catch (err: unknown) {
    const message =
      typeof err === "object" && err !== null && "message" in err
        ? String((err as { message?: unknown }).message ?? "Error fetching orders")
        : "Error fetching orders";
    console.error("Orders API error:", err);
    return res.status(500).json({ message });
  }
}
