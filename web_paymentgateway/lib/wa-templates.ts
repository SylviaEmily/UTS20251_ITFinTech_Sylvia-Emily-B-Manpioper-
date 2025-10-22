// lib/wa-templates.ts
export const WaTpl = {
  checkout: (app: string, orderId: string, total: number, list: string, invoiceUrl: string) => 
`*[${app}]* Checkout berhasil dibuat 🎉
Order ID: ${orderId}
Total: Rp${total.toLocaleString("id-ID")}

Detail:
${list}

Bayar di sini:
${invoiceUrl}

Terima kasih 🙏`,

  paid: (app: string, orderId: string, total: number) =>
`*[${app}]* Pembayaran LUNAS ✅
Order ID: ${orderId}
Total: Rp${total.toLocaleString("id-ID")}

Terima kasih! Pesananmu akan segera kami proses 🙏`,

  failed: (app: string, orderId: string, status: string) =>
`*[${app}]* Pembayaran tidak berhasil ❌
Order ID: ${orderId}
Status: ${status}

Silakan coba lagi atau hubungi admin.`,
};
