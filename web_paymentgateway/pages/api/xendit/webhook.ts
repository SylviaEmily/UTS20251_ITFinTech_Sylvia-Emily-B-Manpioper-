// pages/api/xendit/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { dbConnect } from "../../../lib/mongodb";
import OrderModel from "../../../models/order";

type InternalStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

// payload minimal agar bebas dari `any`
interface XenditWebhookPayload {
  event?: string;
  data?: {
    id?: string;
    invoice_id?: string;
    invoice_url?: string;
    invoiceUrl?: string;
    external_id?: string;
    externalId?: string;
    status?: string;
  };
  // fallback kalau provider mengirim tanpa "data"
  id?: string;
  invoice_id?: string;
  invoice_url?: string;
  invoiceUrl?: string;
  external_id?: string;
  externalId?: string;
  status?: string;
}

function mapXenditToInternal(x?: string): InternalStatus {
  const s = String(x || "").toUpperCase();
  if (s === "PAID" || s === "SETTLED") return "PAID";
  if (s === "EXPIRED" || s === "VOIDED" || s === "CANCELLED") return "CANCELLED";
  if (s === "FAILED" || s === "REFUNDED") return "FAILED";
  return "PENDING";
}
const isFinal = (st?: string): st is "PAID" | "FAILED" | "CANCELLED" =>
  st === "PAID" || st === "FAILED" || st === "CANCELLED";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const tokenHeader = req.headers["x-callback-token"];
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  const expected = process.env.XENDIT_CALLBACK_TOKEN;
  if (!expected) return res.status(500).end("Server misconfigured");
  if (token !== expected) return res.status(401).end("Invalid callback token");

  try {
    await dbConnect();

    const payload = (req.body || {}) as XenditWebhookPayload;
    const d = payload.data || payload;

    const externalId = d.external_id || d.externalId;
    const providerRef = d.id || d.invoice_id;
    const invoiceUrl = d.invoice_url || d.invoiceUrl;
    const nextStatus: InternalStatus = mapXenditToInternal(d.status);

    if (!externalId) {
      console.warn("Webhook tanpa external_id");
      return res.status(200).json({ ignored: true });
    }

    const order = await OrderModel.findById(externalId).lean();
    if (!order) {
      await OrderModel.updateOne(
        { _id: externalId },
        {
          $setOnInsert: { "payment.provider": "xendit" },
          $set: {
            "payment.status": nextStatus,
            ...(providerRef ? { "payment.providerRef": providerRef } : {}),
            ...(invoiceUrl ? { "payment.invoiceUrl": invoiceUrl } : {}),
          },
        },
        { upsert: true }
      );
      return res.status(200).json({ createdFromWebhook: true, status: nextStatus });
    }

    if (isFinal(order.payment?.status)) {
      return res.status(200).json({ alreadyFinal: true, status: order.payment?.status });
    }

    await OrderModel.updateOne(
      { _id: externalId },
      {
        $set: {
          "payment.status": nextStatus,
          ...(providerRef ? { "payment.providerRef": providerRef } : {}),
          ...(invoiceUrl ? { "payment.invoiceUrl": invoiceUrl } : {}),
        },
      }
    );

    return res.status(200).json({ ok: true, status: nextStatus });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("Webhook error:", msg);
    return res.status(200).json({ ok: true });
  }
}
