import Link from 'next/link';
import React, { useRef } from 'react';
import { useCart } from '@/context/CartContext';

function useOrderSubmit(subtotal: number, tax: number, total: number, items: any[]) {
  const shipping = subtotal > 0 ? 12_000 : 0; // contoh ongkir

  const buildPayload = (form: HTMLFormElement | null) => {
    const fd = form ? new FormData(form) : new FormData();
    return {
      customer: {
        name: String(fd.get('name') || ''),
        phone: String(fd.get('phone') || ''),
        address: String(fd.get('address') || ''),
        city: String(fd.get('city') || ''),
        postalCode: String(fd.get('postalCode') || ''),
      },
      items: items.map((ci: any) => ({
        productId: ci.product.id,
        name: ci.product.name,
        price: ci.product.price,
        qty: ci.qty,
        lineTotal: ci.product.price * ci.qty,
        imageUrl: ci.product.imageUrl || '', // ikutkan snapshot gambar ke order (opsional)
      })),
      amounts: { subtotal, tax, shipping, total: total + shipping },
      provider: 'manual', // ganti 'xendit' saat integrasi gateway
    };
  };

  const submit = async (formEl: HTMLFormElement | null) => {
    const payload = buildPayload(formEl);

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Gagal parse JSON. Status ${res.status}. Body: ${text.slice(0, 120)}...`);
    }

    if (!res.ok) throw new Error(data?.message || `Gagal: HTTP ${res.status}`);
    return data as { orderId: string; status: string };
  };

  return { submit, shipping };
}

export default function Payment() {
  const { items, inc, dec, subtotal, tax, total, formatRupiah } = useCart();
  const formRef = useRef<HTMLFormElement>(null);
  const { submit, shipping } = useOrderSubmit(subtotal, tax, total, items);
  const grand = total + shipping;

  async function handleConfirmPay() {
    try {
      const { orderId } = await submit(formRef.current);
      alert(`Order berhasil dibuat: ${orderId}`);
      // TODO: di sini bisa langsung redirect ke Xendit invoiceUrl setelah integrasi
      // window.location.href = '/thankyou/' + orderId;
    } catch (e: any) {
      alert(e.message || 'Gagal membuat order');
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-8">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Link href="/" className="text-sm opacity-70">← Back</Link>
        <h2 className="mx-auto text-center text-lg font-semibold">Payment</h2>
      </div>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* ===== KIRI: Daftar Item (dengan gambar) ===== */}
        <div className="md:col-span-2 rounded-2xl border shadow-sm">
          {items.length === 0 ? (
            <div className="p-8 text-center">
              Keranjang kosong. <Link className="underline" href="/">Tambah item</Link>.
            </div>
          ) : (
            <div className="divide-y">
              {items.map((ci) => {
                const lineTotal = ci.product.price * ci.qty;
                return (
                  <div
                    key={ci.product.id}
                    className="grid grid-cols-12 items-center gap-3 px-4 py-3"
                  >
                    {/* thumbnail produk – tampil di semua ukuran */}
                    <div className="col-span-1">
                      <div className="h-10 w-10 overflow-hidden rounded bg-gray-200">
                        {ci.product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ci.product.imageUrl}
                            alt={ci.product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                    </div>

                    {/* nama & harga satuan */}
                    <div className="col-span-7 md:col-span-6">
                      <p className="font-medium leading-tight">{ci.product.name}</p>
                      <p className="text-xs opacity-70">
                        {formatRupiah(ci.product.price)} / item
                      </p>
                    </div>

                    {/* kontrol qty */}
                    <div className="col-span-3 flex items-center justify-end gap-2">
                      <button
                        onClick={() => dec(ci.product.id)}
                        className="h-8 w-8 rounded border leading-none"
                        aria-label="decrease"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm">{ci.qty}</span>
                      <button
                        onClick={() => inc(ci.product.id)}
                        className="h-8 w-8 rounded border leading-none"
                        aria-label="increase"
                      >
                        +
                      </button>
                    </div>

                    {/* total baris */}
                    <div className="col-span-1 text-right font-medium">
                      {formatRupiah(lineTotal)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== KANAN: Ringkasan + Form Alamat + Confirm ===== */}
        <aside className="h-max rounded-2xl border p-4 shadow-sm md:sticky md:top-6">
          <h3 className="mb-3 text-base font-semibold">Ringkasan Belanja</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatRupiah(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>PPN (11%)</span>
              <span>{formatRupiah(tax)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{formatRupiah(shipping)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatRupiah(grand)}</span>
            </div>
          </div>

          {/* Form alamat ringkas */}
          <h4 className="mt-5 mb-2 text-sm font-semibold">Alamat Pengiriman</h4>
          <form ref={formRef} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nama Penerima</label>
              <input name="name" className="input" placeholder="John Doe" />
            </div>
            <div>
              <label className="label">Telepon</label>
              <input name="phone" className="input" placeholder="08xxxxxxxxxx" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Alamat</label>
              <input name="address" className="input" placeholder="Jl. Contoh No. 123" />
            </div>
            <div>
              <label className="label">Kota</label>
              <input name="city" className="input" placeholder="Jakarta" />
            </div>
            <div>
              <label className="label">Kode Pos</label>
              <input name="postalCode" className="input" placeholder="12345" />
            </div>
          </form>

          {/* Tombol aksi */}
          <button onClick={handleConfirmPay} className="mt-4 w-full rounded-xl bg-black py-3 text-white">
            Confirm &amp; Pay
          </button>
        </aside>
      </section>
    </main>
  );
}
