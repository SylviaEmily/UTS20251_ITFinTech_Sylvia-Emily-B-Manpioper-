// pages/api/webhooks/xendit.ts
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import mongoose, { Types } from "mongoose";
import { sendWhatsApp } from "@/lib/wa";
import { WaTpl } from "@/lib/wa-templates";
import { normalizePhone } from "@/lib/phone";

/** Payload Xendit (cover snake/camel) */
interface XenditWebhookBody {
  id?: string;                 // invoice id
  invoice_id?: string;
  invoiceId?: string;

  external_id?: string;        // "order_<ObjectId>" (kita set saat create)
  externalId?: string;
  externalID?: string;

  status?: string;             // PAID | SETTLED | EXPIRED | FAILED | PENDING
  invoice_status?: string;

  [key: string]: unknown;
}

/** Payment minimal yang dipakai di webhook */
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";
interface PaymentShape {
  status: PaymentStatus;
  providerRef?: string;
  externalId?: string;
  notifPaidSent?: boolean;
}

/** Bentuk dokumen order (lean) yang kita butuhkan */
interface OrderLean {
  _id: Types.ObjectId;
  customer?: { phone?: string | null };
  amounts?: { total?: number | null };
  payment?: PaymentShape;
}

const STATUS_MAP: Record<string, PaymentStatus> = {
  PENDING: "PENDING",
  PAID: "PAID",
  SETTLED: "PAID",
  EXPIRED: "CANCELLED",
  FAILED: "FAILED",
};

const toNumber = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Validasi token callback
  const rawTokenHeader = req.headers["x-callback-token"];
  const tokenHeader = Array.isArray(rawTokenHeader) ? rawTokenHeader[0] : rawTokenHeader;
  if (!process.env.XENDIT_CALLBACK_TOKEN || tokenHeader !== process.env.XENDIT_CALLBACK_TOKEN) {
    return res.status(401).json({ message: "Invalid callback token" });
  }

  try {
    const b = (req.body ?? {}) as XenditWebhookBody;

    const statusRaw = (b.status ?? b.invoice_status ?? "").toString();
    const externalRaw = (b.external_id ?? b.externalId ?? b.externalID ?? "").toString();
    const invoiceId = (b.id ?? b.invoice_id ?? b.invoiceId ?? "").toString();

    if (!statusRaw) {
      return res.status(400).json({ message: "Missing status" });
    }

    // ===== Resolve order (lean) + orderId =====
    let orderDoc: OrderLean | null = null;
    let orderId: Types.ObjectId | null = null;

    // (1) external_id: "order_<ObjectId>"
    if (externalRaw && /^order_/.test(externalRaw)) {
      const maybe = externalRaw.replace(/^order_/, "");
      if (mongoose.isValidObjectId(maybe)) {
        orderDoc = await Order.findById(maybe).lean<OrderLean>().exec();
        if (orderDoc) orderId = orderDoc._id;
      }
    }

    // (2) via invoice id (payment.providerRef)
    if (!orderDoc && invoiceId) {
      orderDoc = await Order.findOne({ "payment.providerRef": invoiceId })
        .lean<OrderLean>()
        .exec();
      if (orderDoc) orderId = orderDoc._id;
    }

    // (3) via payment.externalId (opsional jika kamu simpan saat create)
    if (!orderDoc && externalRaw) {
      orderDoc = await Order.findOne({ "payment.externalId": externalRaw })
        .lean<OrderLean>()
        .exec();
      if (orderDoc) orderId = orderDoc._id;
    }

    if (!orderDoc || !orderId) {
      return res.status(404).json({ message: "Order not found for webhook payload" });
    }

    // ===== Hitung status baru & siapkan update =====
    const incoming = statusRaw.toUpperCase();
    const newStatus: PaymentStatus = STATUS_MAP[incoming] ?? "PENDING";
    const oldStatus: PaymentStatus = (orderDoc.payment?.status ?? "PENDING") as PaymentStatus;
    const alreadySent: boolean = Boolean(orderDoc.payment?.notifPaidSent);

    // set dasar
    const setFields: Record<string, unknown> = {
      "payment.status": newStatus,
    };
    if (invoiceId) setFields["payment.providerRef"] = invoiceId;

    // update status terlebih dulu
    await Order.updateOne({ _id: orderId }, { $set: setFields }).exec();

    // ===== Kirim WA (non-blocking) hanya saat pertama kali PAID =====
    try {
      const phoneRaw = orderDoc.customer?.phone ?? "";
      const phone = normalizePhone(phoneRaw);
      const appName = process.env.APP_NAME || "MyApp";

      if (newStatus === "PAID" && phone && !alreadySent) {
        const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
        const thankyou = `${base}/thankyou/${String(orderId)}`;

        const totalAmount = toNumber(orderDoc.amounts?.total, 0);
        const baseMsg = WaTpl.paid(appName, String(orderId), totalAmount);
        const msg = `${baseMsg}\n\nLihat status & rincian pesanan: ${thankyou}`;

        console.log("WA SEND →", { to: phone, preview: msg.slice(0, 100) });
        await sendWhatsApp(phone, msg);

        // tandai sudah kirim agar tidak dobel saat resend
        await Order.updateOne(
          { _id: orderId },
          { $set: { "payment.notifPaidSent": true } }
        ).exec();

        console.log("WA RESULT ← success");
      } else if ((newStatus === "FAILED" || newStatus === "CANCELLED") && phone) {
        const msg = WaTpl.failed(appName, String(orderId), incoming);
        console.log("WA SEND (fail/cancel) →", { to: phone });
        await sendWhatsApp(phone, msg);
      } else {
        console.log("WA SKIPPED →", {
          phoneExists: Boolean(phone),
          newStatus,
          alreadySent,
          oldStatus,
        });
      }
    } catch (waErr) {
      console.error("WA send error:", waErr);
      // jangan gagalkan webhook
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const message =
      typeof err === "object" && err !== null && "toString" in err
        ? (err as { toString: () => string }).toString()
        : "Webhook error";
    console.error("Webhook error:", message);
    return res.status(500).json({ message: "Webhook error" });
  }
}
