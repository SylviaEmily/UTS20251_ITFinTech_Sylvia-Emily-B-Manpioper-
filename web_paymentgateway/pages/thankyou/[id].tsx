// pages/thankyou/[id].tsx
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { dbConnect } from '@/lib/mongodb';
import OrderModel from '@/models/Order';
import type { Types } from 'mongoose';

type OrderDocLean = {
  _id: Types.ObjectId | string;
  payment?: { status?: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'; providerRef?: string };
  amounts?: { total?: number; currency?: string };
  customer?: { name?: string | null };
};

type OrderDTO = {
  _id: string;
  payment: { status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED'; providerRef?: string };
  amounts: { total: number; currency?: string };
  customer?: { name?: string | null };
};

type Props = { order: OrderDTO };

export default function ThankYou({ order }: Props) {
  const isPaid = order.payment.status === 'PAID';
  const isPending = order.payment.status === 'PENDING';

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6">
        <Link href="/" className="text-sm opacity-70 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">
        Terima kasih{order.customer?.name ? `, ${order.customer.name}` : ''}!
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Order ID:{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5">{order._id}</code>
      </p>

      <div className="mt-4 rounded-2xl border p-4">
        <p className="text-sm">Status pembayaran:</p>
        <p
          className={`mt-1 text-lg font-semibold ${
            isPaid ? 'text-green-600' : isPending ? 'text-amber-600' : 'text-red-600'
          }`}
        >
          {order.payment.status}
        </p>

        {order.payment.providerRef ? (
          <p className="mt-1 text-xs text-gray-500">
            Invoice: {order.payment.providerRef}
          </p>
        ) : null}

        <p className="mt-4">
          Total: <b>{order.amounts.total.toLocaleString('id-ID')}</b>{' '}
          <span className="text-gray-600">{order.amounts.currency ?? 'IDR'}</span>
        </p>

        {isPending && (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Pembayaran masih menunggu. Jika kamu baru saja membayar, status <b>PAID</b> akan
            muncul setelah webhook Xendit diterima. Coba refresh sebentar lagi.
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => location.reload()}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Refresh Status
        </button>
        <Link
          href="/"
          className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  await dbConnect();

  const id = String(params?.id ?? '');
  // ➜ beri generic pada lean<T>() agar bukan 'any' / union aneh
  const doc = await OrderModel.findById(id).lean<OrderDocLean>().exec();

  if (!doc) return { notFound: true };

  const order: OrderDTO = {
    _id: String(doc._id),
    payment: {
      status: (doc.payment?.status ?? 'PENDING') as OrderDTO['payment']['status'],
      providerRef: doc.payment?.providerRef ?? '',
    },
    amounts: {
      total: doc.amounts?.total ?? 0,
      currency: doc.amounts?.currency ?? 'IDR',
    },
    customer: { name: doc.customer?.name ?? '' },
  };

  return { props: { order } };
};
