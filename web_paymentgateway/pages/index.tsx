import Link from 'next/link';
import Header from '@/components/Header';
import { useCart } from '@/context/CartContext';

export default function SelectItem() {
  // ambil produk dari context (sudah fetch dari API MongoDB)
  const { products, add, formatRupiah, loadingProducts } = useCart();

  return (
    <main className="mx-auto max-w-7xl p-8">
      {/* Header tanpa hamburger */}
      <Header showMenu={false} />

      <h2 className="mt-6 border-b pb-3 text-xl font-semibold">All Items</h2>

      {loadingProducts ? (
        <p className="mt-6 text-sm opacity-70">Loading products…</p>
      ) : (
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <article
              key={p.id}
              className="flex items-start gap-4 rounded-2xl border p-5 shadow-sm"
            >
              {/* gambar produk */}
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-200">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>

              <div className="flex flex-1 items-start justify-between gap-2">
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
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Footer link ke checkout */}
      <div className="mt-10 text-center text-sm">
        <Link href="/checkout" className="underline">
          Go to Checkout →
        </Link>
      </div>
    </main>
  );
}
