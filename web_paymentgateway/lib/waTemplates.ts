// lib/waTemplates.ts
export const WA = {
  checkout: (p: {
    name: string;
    orderId: string;
    total: number;       // dalam rupiah
    invoiceUrl?: string; // dari Xendit
  }) => {
    const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(p.total);
    return [
      `*${process.env.APP_NAME || "Toko"}*`,
      `Halo ${p.name}, terima kasih sudah checkout! 🙌`,
      `• ID Pesanan: *${p.orderId}*`,
      `• Total: *${rupiah}*`,
      p.invoiceUrl ? `• Link Pembayaran: ${p.invoiceUrl}` : "",
      "",
      `Segera selesaikan pembayaran ya. Jika sudah bayar, status akan otomatis terupdate.`,
    ].filter(Boolean).join("\n");
  },

  paid: (p: {
    name: string;
    orderId: string;
    amount: number;
  }) => {
    const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(p.amount);
    return [
      `*${process.env.APP_NAME || "Toko"}*`,
      `Pembayaran *LUNAS* ✅`,
      `• ID Pesanan: *${p.orderId}*`,
      `• Jumlah: *${rupiah}*`,
      "",
      `Terima kasih, ${p.name}! Pesananmu sedang diproses.`,
    ].join("\n");
  },

  failed: (p: { name: string; orderId: string }) =>
    [
      `*${process.env.APP_NAME || "Toko"}*`,
      `Mohon maaf, pembayaran untuk pesanan *${p.orderId}* *GAGAL* ❌`,
      `Silakan coba lagi melalui halaman pembayaran atau lakukan checkout ulang.`,
    ].join("\n"),
};
