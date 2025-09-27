// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from "next";
// ✅ gunakan dbConnect (bukan connectDB)
import { dbConnect } from "@/lib/mongodb";
// ✅ gunakan default export model (bukan type)
import OrderModel from "@/models/order";

// supaya aman di Next/TS (ESM/CJS)
const Xendit = require("xendit-node");

type Resp =
  | {
      orderId: string;
      status: string;
      invoiceUrl: string;
      externalId: string;
      provider: "xendit";
    }
  | { message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { orderId } = req.body as { orderId?: string };
    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    // env wajib
    const secret = process.env.XENDIT_SECRET_KEY;
    const appUrl = process.env.APP_URL;
    if (!secret || !appUrl) {
      return res
        .status(500)
        .json({ message: "Set ENV XENDIT_SECRET_KEY dan APP_URL terlebih dahulu" });
    }

    await dbConnect();

    // ambil order dari DB
    const order = await OrderModel.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    const total =
      typeof order?.amounts?.total === "number" && Number.isFinite(order.amounts.total)
        ? order.amounts.total
        : 0;

    if (!total || total <= 0) {
      return res
        .status(400)
        .json({ message: "Order total is invalid (amounts.total must be > 0)" });
    }

    const payerEmail =
      (order?.customer?.email as string | undefined) || undefined;
    const currency =
      (order?.amounts?.currency as string | undefined) || "IDR";

    // buat invoice di Xendit
    const x = new Xendit({ secretKey: secret });
    const { InvoiceApi } = x;
    const invoiceApi = new InvoiceApi();

    const create = await invoiceApi.createInvoice({
      data: {
        externalId: orderId, // penting: cocokkan dengan webhook nanti
        amount: total,
        payerEmail,
        description: `Order ${orderId}`,
        currency,
        successRedirectUrl: `${appUrl}/success`,
        failureRedirectUrl: `${appUrl}/failed`,
      },
    });

    const invoiceId: string = create?.data?.id || "";
    const invoiceUrl: string = create?.data?.invoiceUrl || "";
    const status: string = String(create?.data?.status || "PENDING").toUpperCase();

    // update order di DB
    await OrderModel.updateOne(
      { _id: orderId },
      {
        $set: {
          "payment.provider": "xendit",
          "payment.providerRef": invoiceId,
          "payment.invoiceUrl": invoiceUrl,
          "payment.status": status === "PAID" ? "PAID" : "PENDING",
        },
      }
    );

    return res.status(200).json({
      orderId,
      status: status === "PAID" ? "PAID" : "PENDING",
      invoiceUrl,
      externalId: orderId,
      provider: "xendit",
    });
  } catch (err: any) {
    console.error("Checkout error:", err?.response?.data || err?.message || err);
    return res.status(500).json({
      message: err?.response?.data?.message || err?.message || "Internal Server Error",
    });
  }
}
