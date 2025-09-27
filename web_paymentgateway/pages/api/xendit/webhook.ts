// pages/api/xendit/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { dbConnect } from "@/lib/mongodb";
import OrderModel from "@/models/order";

// Status internal mengikuti schema kamu
type InternalStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

function mapXenditToInternal(x: string | undefined): InternalStatus {
  const s = String(x || "").toUpperCase();
  if (s === "PAID" || s === "SETTLED") return "PAID";
  if (s === "EXPIRED" || s === "VOIDED" || s === "CANCELLED") return "CANCELLED";
  if (s === "FAILED" || s === "REFUNDED") return "FAILED";
  return "PENDING";
}
function isFinal(st: string | undefined) {
  return st === "PAID" || st === "FAILED" || st === "CANCELLED";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  // Verifikasi token webhook dari Xendit
  const tokenHeader = req.headers["x-callback-token"];
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  const expected = process.env.XENDIT_CALLBACK_TOKEN;
  if (!expected) {
    console.error("ENV XENDIT_CALLBACK_TOKEN is missing");
    return res.status(500).end("Server misconfigured");
  }
  if (token !== expected) return res.status(401).end("Invalid callback token");

  try {
    await dbConnect();

    const payload = (req.body || {}) as any;
    // Xendit umumnya { event, data: {...} }
    const data = payload?.data ?? payload ?? {};

    const externalId: string | undefined = data?.external_id ?? data?.externalId;
    const providerRef: string | undefined = data?.id ?? data?.invoice_id;
    const invoiceUrl: string | undefined = data?.invoice_url ?? data?.invoiceUrl;

    if (!externalId) {
      console.warn("Webhook tanpa external_id:", JSON.stringify(payload));
      return res.status(200).json({ ignored: true });
    }

    const nextStatus: InternalStatus = mapXenditToInternal(data?.status);

    // Cari order by _id (kita memang pakai orderId sebagai externalId)
    const order = await OrderModel.findById(externalId).lean();

    // Jika belum ada, upsert minimal agar status tidak hilang
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

    // Jika sudah final (PAID/FAILED/CANCELLED), jangan proses lagi
    if (isFinal(order.payment?.status)) {
      return res.status(200).json({ alreadyFinal: true, status: order.payment?.status });
    }

    // Update status pembayaran
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

    // Fast ACK
    return res.status(200).json({ ok: true, status: nextStatus });
  } catch (err: any) {
    console.error("Webhook error:", err?.message || err);
    // Tetap 200 agar Xendit tidak banjir retry; kerja berat bisa di-queue
    return res.status(200).json({ ok: true });
  }
}
