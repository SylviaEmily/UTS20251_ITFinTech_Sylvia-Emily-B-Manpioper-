// pages/thankyou/[id].tsx
import type { GetServerSideProps } from "next";
import Link from "next/link";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import mongoose from "mongoose";

/** Bentuk data yang dipakai di UI (sudah diserialisasi, aman untuk JSON) */
type OrderSafe = {
  _id: string;
  amounts?: { total?: number } | null;
  payment?: { status?: string } | null;
  items?: Array<{ name: string; price: number; qty: number }> | null;
  createdAt?: string | null;
};

/** Props halaman (discriminated union supaya aman saat akses) */
type Props = { ok: true; order: OrderSafe } | { ok: false };

export default function ThankYouPage(props: Props) {
  if (!("ok" in props) || props.ok === false) {
    return <main className="p-6">Order tidak ditemukan.</main>;
  }
  const { order } = props;

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
          <strong>{order.payment?.status ?? "-"}</strong>
        )}
      </p>

      <section className="mb-6 rounded-xl border p-4">
        <ul className="space-y-1 text-sm">
          <li>ID Order: <span className="font-mono">{order._id}</span></li>
          <li>Status: <strong>{order.payment?.status ?? "-"}</strong></li>
          <li>Total: <strong>Rp {(order.amounts?.total ?? 0).toLocaleString("id-ID")}</strong></li>
          <li>Waktu: {order.createdAt ? new Date(order.createdAt).toLocaleString("id-ID") : "-"}</li>
        </ul>
      </section>

      {order.items?.length ? (
        <section className="mb-6 rounded-xl border p-4">
          <h2 className="mb-2 font-medium">Item</h2>
          <ul className="space-y-1 text-sm">
            {order.items.map((it, i) => (
              <li key={i} className="flex justify-between">
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

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { id } = ctx.params as { id?: string };
  if (!id || !mongoose.isValidObjectId(id)) {
    return { props: { ok: false } };
  }

  await dbConnect();

  /** Definisikan bentuk dokumen lean agar TS tahu propertinya */
  type OrderLean = {
    _id: mongoose.Types.ObjectId;
    amounts?: { total?: number } | null;
    payment?: { status?: string } | null;
    items?: Array<{ name: string; price: number; qty: number }> | null;
    createdAt?: Date | string | null;
  };

  // Pakai generic di .lean<...>() untuk menghindari FlattenMaps<any>
  const doc = await Order.findById(id).lean<OrderLean>().exec();

  if (!doc) return { props: { ok: false } };

  const order: OrderSafe = {
    _id: String(doc._id),
    amounts: doc.amounts ?? null,
    payment: doc.payment ?? null,
    items: doc.items ?? [],
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  };

  return { props: { ok: true, order } };
};
