// lib/notify-order.ts
import { sendWhatsApp } from "./wa";
import { WaTpl } from "./wa-templates";
import { normalizePhone } from "./phone";
import type { OrderBase } from "@/models/Order";

// Item minimal yang kita butuhkan untuk format pesan
type OrderItemLike = {
  name: string;
  qty: number;
  lineTotal?: number;
  price?: number;
};

/**
 * Kirim notifikasi WA ketika checkout berhasil
 */
export async function notifyCheckout(
  order: OrderBase | (OrderBase & { _id?: unknown })
): Promise<void> {
  try {
    const phone = normalizePhone(order.customer?.phone ?? "");
    // siapkan id bila ada (hindari error _id not in type)
    const orderId = ("_id" in order && order._id != null) ? String((order as any)._id) : "";

    if (!phone) {
      console.warn("⚠️ No phone number in order:", orderId);
      return;
    }

    const appName = process.env.APP_NAME || "MyApp";

    // pastikan items iterable dengan bentuk yang kita kenal
    const items = (order.items as unknown as OrderItemLike[]) ?? [];

    // Hitung line total per item (fallback ke price * qty bila lineTotal tidak ada)
    const itemsList = items
      .map((item, idx) => {
        const lineTotal = item.lineTotal ?? ((item.price ?? 0) * item.qty);
        return `${idx + 1}. ${item.name} (${item.qty}x) = Rp${lineTotal.toLocaleString("id-ID")}`;
      })
      .join("\n");

    // Total order: pakai amounts.total bila ada, fallback ke penjumlahan item
    const computedTotal =
      order.amounts?.total ??
      items.reduce((sum, it) => sum + (it.lineTotal ?? ((it.price ?? 0) * it.qty)), 0);

    // Invoice URL opsional
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
