// pages/api/orders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { dbConnect } from "../../lib/mongodb";
import OrderModel /* ... */ from "../../models/order";
// Helpers
const toStr = (v: unknown): string => (typeof v === "string" ? v : "");
const toNum = (v: unknown, def = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

// ====== TYPES INPUT (plain object, bukan Mongoose Document) ======
type CreateOrderBody = {
  customer?: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    email?: string | null;
  };
  items: Array<{ productId: string; name: string; price: number; qty: number; lineTotal?: number }>;
  amounts?: {
    subtotal?: number | null;
    tax?: number | null;
    shipping?: number | null;
    total?: number | null;
    currency?: string | null;
  };
  provider?: "manual" | "xendit" | "midtrans" | "stripe";
};

type OrderItemInput = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  lineTotal: number;
};

type AmountsInput = {
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string; // ubah ke union kalau schema kamu membatasi
};

type PaymentInput = {
  provider: "manual" | "xendit" | "midtrans" | "stripe";
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  providerRef: string;
  invoiceUrl: string;
  channel: string;
  failureReason: string;
};

type OrderCreateInput = {
  customer: {
    name: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    email: string;
  };
  items: OrderItemInput[];
  amounts: AmountsInput;
  payment: PaymentInput;
};
// ================================================================

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await dbConnect();

    const body = (req.body || {}) as CreateOrderBody;

    // Items -> plain array (bukan DocumentArray)
    const items: OrderItemInput[] = (body.items ?? []).map((it) => ({
      productId: toStr(it.productId),
      name: toStr(it.name),
      price: toNum(it.price),
      qty: toNum(it.qty),
      lineTotal: toNum(it.lineTotal, toNum(it.price) * toNum(it.qty)),
    }));
    if (items.length === 0) {
      return res.status(400).json({ message: "Items cannot be empty" });
    }

    // Amounts (safe numbers)
    const calcSubtotal = items.reduce((s, it) => s + toNum(it.lineTotal), 0);
    const aSubtotal = toNum(body.amounts?.subtotal, calcSubtotal);
    const aTax = toNum(body.amounts?.tax, 0);
    const aShipping = toNum(body.amounts?.shipping, 0);
    const aTotal = toNum(body.amounts?.total, aSubtotal + aTax + aShipping);
    const aCurrency = toStr(body.amounts?.currency) || "IDR";

    const amounts: AmountsInput = {
      subtotal: aSubtotal,
      tax: aTax,
      shipping: aShipping,
      total: aTotal,
      currency: aCurrency,
    };

    const provider = body.provider ?? "manual";

    // Payload input ke Mongoose (plain JS object)
    const orderData: OrderCreateInput = {
      customer: {
        name: toStr(body.customer?.name),
        phone: toStr(body.customer?.phone),
        address: toStr(body.customer?.address),
        city: toStr(body.customer?.city),
        postalCode: toStr(body.customer?.postalCode),
        email: toStr(body.customer?.email),
      },
      items,
      amounts,
      payment: {
        provider,
        status: "PENDING",
        providerRef: "",
        invoiceUrl: "",
        channel: "",
        failureReason: "",
      },
    };

    // Mongoose akan cast otomatis ke subdocument yang sesuai
    const doc = await OrderModel.create(orderData);

    return res.status(201).json({
      orderId: String(doc._id),
      status: doc.payment?.status ?? "PENDING",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Create order error:", msg);
    return res.status(500).json({ message: msg });
  }
}
