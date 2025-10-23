// lib/notify-order.ts
import { sendWhatsApp } from "./wa";
import { WaTpl } from "./wa-templates";
import { normalizePhone } from "./phone";
import type { OrderBase } from "@/models/Order";

// Minimal tipe item yang kita butuhkan untuk pesan
type OrderItemLike = {
  name: string;
  qty: number;
  lineTotal?: number;
  price?: number;
};

// Type guard aman untuk _id (tanpa any)
type WithId = { _id: unknown };
function hasId(obj: unknown): obj is WithId {
  return !!obj && typeof obj === "object" && "_id" in obj && (obj as Record<string, unknown>)._id != null;
}

/**
 * Kirim notifikasi WA ketika checkout berhasil
 */
export async function notifyCheckout(order: OrderBase): Promise<void> {
  try {
    const phone = normalizePhone(order.customer?.phone ?? "");
    const orderId = hasId(order) ? String((order as WithId)._id) : "";

    if (!phone) {
      console.warn("⚠️ No phone number in order:", orderId);
      return;
    }

    const appName = process.env.APP_NAME || "MyApp";

    // Coerce items tanpa menggunakan 'any'
    const rawItems = Array.isArray(order.items) ? order.items : [];
    const items: OrderItemLike[] = rawItems.map((it) => {
      const name = (it as { name?: string }).name ?? "Item";
      const qty = (it as { qty?: number }).qty ?? 0;
      const price = (it as { price?: number }).price ?? 0;
      const lineTotal = (it as { lineTotal?: number }).lineTotal;
      return { name, qty, price, lineTotal };
    });

    const itemsList = items
      .map((item, idx) => {
        const lineTotal = item.lineTotal ?? item.price! * item.qty;
        return `${idx + 1}. ${item.name} (${item.qty}x) = Rp${lineTotal.toLocaleString("id-ID")}`;
      })
      .join("\n");

    const computedTotal =
      order.amounts?.total ??
      items.reduce((sum, it) => sum + (it.lineTotal ?? (it.price ?? 0) * it.qty), 0);

    const invoiceUrl = order.payment?.invoiceUrl ?? "";

    const message = WaTpl.checkout(
      appName,
      orderId,
      computedTotal,
      itemsList,
      invoiceUrl
    );

    await sendWhatsApp(phone, message);
    console.log(`✅ Checkout WA sent to: ${phone}`);
  } catch (error) {
    console.error("⚠️ Failed to send checkout WA:", error);
    // Jangan throw error, biar order tetap jalan
  }
}
