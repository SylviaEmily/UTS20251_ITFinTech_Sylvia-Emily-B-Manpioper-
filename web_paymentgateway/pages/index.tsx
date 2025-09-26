import Link from 'next/link';
import Header from '@/components/Header';
import { useCart } from '@/context/CartContext';

export default function SelectItem() {
  const { products, add, formatRupiah } = useCart();

  return (
    <main className="mx-auto max-w-7xl p-8">
      {/* Header tanpa hamburger */}
      <Header showMenu={false} />

      {/* (Search bar DIHAPUS) */}

      {/* Tabs (biarkan, jika mau hapus tinggal delete blok ini) */}
      <h2 className="mt-6 border-b pb-3 text-xl font-semibold">
        All Items
      </h2>

      {/* Produk TANPA gambar */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => (
          <article
            key={p.id}
            className="flex items-center justify-between rounded-2xl border p-5 shadow-sm"
          >
            <div>
              <h3 className="text-base font-semibold">{p.name}</h3>
              <p className="text-sm">{formatRupiah(p.price)}</p>
              <p className="text-xs text-gray-500">{p.description}</p>
            </div>

            <button
              onClick={() => add(p)}
              className="rounded-xl border px-4 py-2 text-sm font-medium"
            >
              Add +
            </button>
          </article>
        ))}
      </section>

      {/* Footer link ke checkout (opsional) */}
      <div className="mt-10 text-center text-sm">
        <Link href="/checkout" className="underline">
          Go to Checkout →
        </Link>
      </div>

      {/* (Tulisan "Select Item" DIHAPUS) */}
    </main>
  );
}
