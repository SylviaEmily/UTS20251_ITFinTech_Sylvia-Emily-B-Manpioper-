// pages/thankyou/[id].tsx
import Link from 'next/link';
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { dbConnect } from '@/lib/mongodb';
import Order from '@/models/Order';

type PaidStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

type PaymentLean = {
  status?: PaidStatus;
  providerRef?: string;
  invoiceUrl?: string;
};

type AmountsLean = {
  total?: number;
  currency?: 'IDR' | string;
};

// Tipe data minimal dokumen Order saat .lean()
type OrderLean = {
  _id: string;
  payment?: PaymentLean;
  amounts?: AmountsLean;
};

// DTO yang dipakai komponen
type OrderDTO = {
  _id: string;
  payment: { status: PaidStatus; providerRef: string; invoiceUrl: string };
  amounts: { total: number; currency: 'IDR' | string };
};

export default function ThankYouPage(
  { order, forcePaid }: InferGetServerSidePropsType<typeof getServerSideProps>
) {
  const uiStatus: PaidStatus = forcePaid ? 'PAID' : order.payment.status;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/" className="text-sm opacity-70">← Back to Home</Link>
      <h1 className="mt-2 text-xl font-semibold">Terima kasih!</h1>

      <section className="mt-4 rounded-xl border p-4">
        <p className="text-sm">Order ID: <b>{order._id}</b></p>
        <p className="mt-1 text-sm">
          Status pembayaran: <b>{uiStatus}</b>
          {forcePaid && (
            <span className="ml-2 rounded bg-yellow-100 px-2 py-0.5 text-xs">
              Simulated
            </span>
          )}
        </p>
        <p className="mt-1 text-sm">
          Total: <b>{order.amounts.total.toLocaleString('id-ID')} {order.amounts.currency || 'IDR'}</b>
        </p>
        {uiStatus !== 'PAID' && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 p-2 rounded">
            Pembayaran menunggu webhook Xendit. Jika kamu baru saja membayar, status
            <b> PAID</b> akan muncul setelah webhook diterima.
          </p>
        )}
      </section>

      <div className="mt-4 flex gap-2">
        <Link href={`/thankyou/${order._id}`} className="rounded border px-3 py-2 text-sm">
          Refresh Status
        </Link>
        <Link href="/" className="rounded bg-black px-3 py-2 text-sm text-white">
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<{
  order: OrderDTO;
  forcePaid: boolean;
}> = async ({ params }) => {
  await dbConnect();

  const id = String(params?.id || '');
  // Ambil SATU dokumen + lean dgn tipe aman (tanpa any)
  const doc = await Order.findById(id)
    .select('_id payment amounts')
    .lean<OrderLean | null>();

  if (!doc) return { notFound: true };

  const order: OrderDTO = {
    _id: String(doc._id),
    payment: {
      status: doc.payment?.status ?? 'PENDING',
      providerRef: doc.payment?.providerRef ?? '',
      invoiceUrl: doc.payment?.invoiceUrl ?? '',
    },
    amounts: {
      total: typeof doc.amounts?.total === 'number' ? doc.amounts.total : 0,
      currency: doc.amounts?.currency ?? 'IDR',
    },
  };

  const forcePaid = process.env.NEXT_PUBLIC_FORCE_THANKYOU_PAID === 'true';

  return { props: { order, forcePaid } };
};
