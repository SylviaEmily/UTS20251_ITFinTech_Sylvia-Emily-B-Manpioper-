// pages/thankyou/[id].tsx
import { useRouter } from "next/router";
import Link from "next/link";
import { useEffect, useState } from "react";

type Order = {
  _id: string;
  customer?: { name?: string; email?: string; phone?: string };
  items?: Array<{ name: string; price: number; qty: number }>;
  amounts?: { subtotal?: number; total?: number };
  payment?: { status?: "PENDING" | "PAID" | "FAILED" | "CANCELLED"; providerRef?: string };
  createdAt?: string;
};

export default function ThankYou() {
  const router = useRouter();
  const { id } = router.query;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${id}`);
        const data = await res.json();
        setOrder(data.order);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <main className="p-6">Memuat…</main>;
  if (!order) return <main className="p-6">Order tidak ditemukan.</main>;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Terima kasih! 🙏</h1>
      <p className="mb-6 text-gray-600">
        Pembayaran untuk <span className="font-mono">#{order._id}</span>{" "}
        {order.payment?.status === "PAID" ? (
          <strong className="text-green-600">sudah diterima.</strong>
        ) : order.payment?.status === "PENDING" ? (
          <strong className="text-amber-600">masih pending.</strong>
        ) : order.payment?.status === "FAILED" ? (
          <strong className="text-red-600">gagal.</strong>
        ) : (
          <strong>{order.payment?.status}</strong>
        )}
      </p>

      <section className="mb-6 rounded-xl border p-4">
        <h2 className="mb-3 font-medium">Ringkasan</h2>
        <ul className="space-y-1 text-sm">
          <li>ID Order: <span className="font-mono">{order._id}</span></li>
          <li>Status: <strong>{order.payment?.status}</strong></li>
          <li>Total: <strong>Rp {(order.amounts?.total ?? 0).toLocaleString("id-ID")}</strong></li>
          <li>Waktu: {order.createdAt ? new Date(order.createdAt).toLocaleString("id-ID") : "-"}</li>
        </ul>
      </section>

      {order.items?.length ? (
        <section className="mb-6 rounded-xl border p-4">
          <h2 className="mb-3 font-medium">Item</h2>
          <ul className="space-y-1 text-sm">
            {order.items.map((it, idx) => (
              <li key={idx} className="flex justify-between">
                <span>{it.name} × {it.qty}</span>
                <span>Rp {(it.price * it.qty).toLocaleString("id-ID")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex gap-2">
        <Link href="/" className="rounded-lg border px-3 py-2">Kembali ke Beranda</Link>
        <Link href="/checkout" className="rounded-lg border px-3 py-2">Lihat Keranjang</Link>
      </div>
    </main>
  );
}
