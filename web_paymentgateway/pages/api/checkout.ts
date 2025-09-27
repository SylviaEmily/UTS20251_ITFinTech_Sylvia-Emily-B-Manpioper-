// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { dbConnect } from "../../lib/mongodb";
import OrderModel from "../../models/order";
import Xendit from "xendit-node";

// ---- minimal typing utk SDK ----
interface InvoiceCreateResult {
  data: { id?: string; invoiceUrl?: string; status?: string };
}
interface InvoiceApi {
  createInvoice(args: {
    data: {
      externalId: string;
      amount: number;
      payerEmail?: string;
      description?: string;
      currency?: string;
      successRedirectUrl?: string;
      failureRedirectUrl?: string;
    };
  }): Promise<InvoiceCreateResult>;
}
interface XenditCtor {
  new (args: { secretKey: string }): { InvoiceApi: new () => InvoiceApi };
}
const XenditTyped = Xendit as unknown as XenditCtor;

type Resp =
  | {
      orderId: string;
      status: string;
      invoiceUrl: string;
      externalId: string;
      provider: "xendit";
    }
  | { message: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { orderId } = req.body as { orderId?: string };
    if (!orderId) return res.status(400).json({ message: "orderId is required" });

    const secret = process.env.XENDIT_SECRET_KEY;
    const appUrl = process.env.APP_URL;
    if (!secret || !appUrl)
      return res.status(500).json({ message: "Set ENV XENDIT_SECRET_KEY & APP_URL" });

    await dbConnect();

    const order = await OrderModel.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });

    const total =
      typeof order?.amounts?.total === "number" && Number.isFinite(order.amounts.total)
        ? order.amounts.total
        : 0;
    if (!total) return res.status(400).json({ message: "Order total is invalid" });

    const payerEmail = (order?.customer?.email as string | undefined) || undefined;
    const currency = (order?.amounts?.currency as string | undefined) || "IDR";

    const x = new XenditTyped({ secretKey: secret });
    const invoiceApi = new x.InvoiceApi();

    const created = await invoiceApi.createInvoice({
      data: {
        externalId: orderId,
        amount: total,
        payerEmail,
        description: `Order ${orderId}`,
        currency,
        successRedirectUrl: `${appUrl}/success`,
        failureRedirectUrl: `${appUrl}/failed`,
      },
    });

    const invoiceId = created.data.id || "";
    const invoiceUrl = created.data.invoiceUrl || "";
    const status = String(created.data.status || "PENDING").toUpperCase();

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Checkout error:", msg);
    return res.status(500).json({ message: msg });
  }
}
