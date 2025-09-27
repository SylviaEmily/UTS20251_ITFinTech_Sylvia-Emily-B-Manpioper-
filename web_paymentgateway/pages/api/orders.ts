// pages/api/orders.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { dbConnect } from "@/lib/mongodb";
import OrderModel, { type OrderBase } from "@/models/order";

// Helpers aman
const toStr = (v: unknown): string => (typeof v === "string" ? v : "");
const toNum = (v: unknown, def = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

type CreateOrderBody = {
  customer?: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    email?: string | null;
  };
  items: Array<{
    productId: string;
    name: string;
    price: number;
    qty: number;
    lineTotal?: number;
  }>;
  amounts?: {
    subtotal?: number | null;
    tax?: number | null;
    shipping?: number | null;
    total?: number | null;
    currency?: string | null;
  };
  provider?: "manual" | "xendit" | "midtrans" | "stripe";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await dbConnect();

    const body = (req.body || {}) as CreateOrderBody;

    // ---- Items: plain array (bukan DocumentArray) ----
    const itemsInput = (body.items ?? []).map((it) => ({
      productId: toStr(it.productId),
      name: toStr(it.name),
      price: toNum(it.price),
      qty: toNum(it.qty),
      lineTotal: toNum(it.lineTotal, toNum(it.price) * toNum(it.qty)),
      // JANGAN tambahkan properti yang tidak ada di schema (mis. imageUrl)
    }));

    if (itemsInput.length === 0) {
      return res.status(400).json({ message: "Items cannot be empty" });
    }

    // ---- Amounts: pastikan number valid & currency tidak kosong ----
    const calcSubtotal = itemsInput.reduce((s, it) => s + toNum(it.lineTotal), 0);
    const aSubtotal = toNum(body.amounts?.subtotal, calcSubtotal);
    const aTax = toNum(body.amounts?.tax, 0);
    const aShipping = toNum(body.amounts?.shipping, 0);
    const aTotal = toNum(body.amounts?.total, aSubtotal + aTax + aShipping);
    const aCurrency = toStr(body.amounts?.currency) || "IDR";

    // NOTE: kalau di tipe kamu currency adalah union ('IDR'|'USD'|...), cast ke union:
    type AmountsT = NonNullable<OrderBase["amounts"]>;
    const amountsInput: AmountsT = {
      subtotal: aSubtotal,
      tax: aTax,
      shipping: aShipping,
      total: aTotal,
      currency: aCurrency as AmountsT["currency"],
    };

    const provider = body.provider ?? "manual";

    // ---- Bangun payload input polos (tanpa Document fields) ----
    // IMPORTANT: cast ke 'any' saat dipassing ke Mongoose agar tidak konflik dengan Document types.
    const orderData/*: Omit<OrderBase, "_id"|"createdAt"|"updatedAt">*/ = {
      customer: {
        name: toStr(body.customer?.name),
        phone: toStr(body.customer?.phone),
        address: toStr(body.customer?.address),
        city: toStr(body.customer?.city),
        postalCode: toStr(body.customer?.postalCode),
        email: toStr(body.customer?.email),
      },
      items: itemsInput,
      amounts: amountsInput,
      payment: {
        provider,
        status: "PENDING",
        providerRef: "",
        invoiceUrl: "",
        channel: "",
        failureReason: "",
      },
    };

    // >>> KUNCI ANTI-TS2740 <<<
    // Mongoose akan meng-cast plain object ini ke subdocument yang sesuai.
    const doc = await OrderModel.create(orderData as any);

    return res.status(201).json({
      orderId: String(doc._id),
      status: doc.payment?.status ?? "PENDING",
    });
  } catch (err: any) {
    console.error("Create order error:", err?.response?.data || err?.message || err);
    return res
      .status(500)
      .json({ message: err?.response?.data?.message || err?.message || "Internal Server Error" });
  }
}
