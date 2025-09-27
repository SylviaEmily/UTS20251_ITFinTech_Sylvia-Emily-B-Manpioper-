import Link from 'next/link';
import { useCart } from '@/context/CartContext';

export default function Checkout() {
  const { items, inc, dec, subtotal, tax, total, formatRupiah } = useCart();

  return (
    <main className="mx-auto max-w-7xl p-8">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Link href="/" className="text-sm opacity-70">← Back</Link>
        <h2 className="mx-auto text-center text-lg font-semibold">Checkout</h2>
      </div>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* ===== KIRI: Daftar Item ===== */}
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
                    {/* thumbnail produk */}
                    <div className="col-span-1 hidden md:block">
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
                    <div className="col-span-2 text-right font-medium">
                      {formatRupiah(lineTotal)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== KANAN: Ringkasan (sticky) ===== */}
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
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatRupiah(total)}</span>
            </div>
          </div>

          <Link href="/payment" className="mt-4 block">
            <button className="w-full rounded-xl bg-black py-3 text-white">
              Lanjut ke Pembayaran →
            </button>
          </Link>
        </aside>
      </section>
    </main>
  );
}
