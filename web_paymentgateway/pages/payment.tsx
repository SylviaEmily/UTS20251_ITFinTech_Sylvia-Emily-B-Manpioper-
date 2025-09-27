import Link from 'next/link';
import React, { useRef, useState } from 'react';
import { useCart } from '@/context/CartContext';

type PayStatus = 'idle' | 'processing' | 'success' | 'error';
type CartProduct = { id: string; name: string; price: number; imageUrl?: string };
type CartItem = { product: CartProduct; qty: number };

type OrderItemPayload = {
  productId: string; name: string; price: number; qty: number; lineTotal: number; imageUrl?: string;
};
type OrderPayload = {
  customer: { name: string; phone: string; address: string; city: string; postalCode: string; email: string };
  items: OrderItemPayload[];
  amounts: { subtotal: number; tax: number; shipping: number; total: number; currency?: 'IDR' };
  notes?: string;
};
type ApiOrderOk = {
  success: true;
  orderId: string;
  invoiceUrl?: string;
  invoiceId?: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  needsManualPayment?: boolean;
  message?: string;
};
type ApiOrderErr = { message: string };

function useOrderSubmit(subtotal: number, tax: number, total: number, items: CartItem[]) {
  const shipping = subtotal > 0 ? 12_000 : 0;

  const buildPayload = (form: HTMLFormElement | null): OrderPayload => {
    const fd = form ? new FormData(form) : new FormData();
    return {
      customer: {
        name: String(fd.get('name') ?? ''),
        phone: String(fd.get('phone') ?? ''),
        address: String(fd.get('address') ?? ''),
        city: String(fd.get('city') ?? ''),
        postalCode: String(fd.get('postalCode') ?? ''),
        email: String(fd.get('email') ?? ''),
      },
      items: items.map<OrderItemPayload>((ci) => ({
        productId: ci.product.id,
        name: ci.product.name,
        price: ci.product.price,
        qty: ci.qty,
        lineTotal: ci.product.price * ci.qty,
        imageUrl: ci.product.imageUrl || undefined,
      })),
      amounts: { subtotal, tax, shipping, total: total + shipping, currency: 'IDR' },
    };
  };

  const submit = async (formEl: HTMLFormElement | null): Promise<ApiOrderOk> => {
    const payload = buildPayload(formEl);
    const r = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });

    const text = await r.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch {
      throw new Error(`Gagal parse JSON. Status ${r.status}. Body: ${text.slice(0, 120)}...`);
    }
    if (!r.ok) { const err = parsed as ApiOrderErr | undefined; throw new Error(err?.message ?? `Gagal: HTTP ${r.status}`); }
    return parsed as ApiOrderOk;
  };

  return { submit, shipping };
}

export default function Payment() {
  const { items, inc, dec, subtotal, tax, total, formatRupiah } = useCart();
  const formRef = useRef<HTMLFormElement>(null);
  const { submit, shipping } = useOrderSubmit(subtotal, tax, total, items);
  const grand = total + shipping;

  const [status, setStatus] = useState<PayStatus>('idle');

  async function handleConfirmPay() {
    try {
      setStatus('processing');
      const dto = await submit(formRef.current);

      if (dto.status === 'FAILED' || dto.needsManualPayment) {
        setStatus('error');
        alert(dto.message ?? 'Gagal inisialisasi pembayaran. Silakan coba lagi.');
        return;
      }

      setStatus('success');
      if (dto.invoiceUrl) window.location.href = dto.invoiceUrl;
      else alert(`Order berhasil dibuat: ${dto.orderId}`);
    } catch (e: unknown) {
      setStatus('error');
      const msg = e instanceof Error ? e.message : 'Gagal membuat order/invoice';
      alert(msg);
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/" className="text-sm opacity-70">← Back</Link>
        <h2 className="mx-auto text-center text-lg font-semibold">Payment</h2>
      </div>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
                  <div key={ci.product.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
                    <div className="col-span-1">
                      <div className="h-10 w-10 overflow-hidden rounded bg-gray-200">
                        {ci.product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ci.product.imageUrl} alt={ci.product.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                    </div>

                    <div className="col-span-7 md:col-span-6">
                      <p className="font-medium leading-tight">{ci.product.name}</p>
                      <p className="text-xs opacity-70">{formatRupiah(ci.product.price)} / item</p>
                    </div>

                    <div className="col-span-3 flex items-center justify-end gap-2">
                      <button onClick={() => dec(ci.product.id)} className="h-8 w-8 rounded border" disabled={status === 'processing'}>−</button>
                      <span className="w-6 text-center text-sm">{ci.qty}</span>
                      <button onClick={() => inc(ci.product.id)} className="h-8 w-8 rounded border" disabled={status === 'processing'}>+</button>
                    </div>

                    <div className="col-span-1 text-right font-medium">{formatRupiah(lineTotal)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="h-max rounded-2xl border p-4 shadow-sm md:sticky md:top-6">
          <h3 className="mb-3 text-base font-semibold">Ringkasan Belanja</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
            <div className="flex justify-between"><span>PPN (11%)</span><span>{formatRupiah(tax)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{formatRupiah(shipping)}</span></div>
            <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatRupiah(grand)}</span></div>
          </div>

          <h4 className="mt-5 mb-2 text-sm font-semibold">Alamat Pengiriman</h4>
          <form ref={formRef} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label">Nama Penerima</label><input name="name" className="input" placeholder="John Doe" /></div>
            <div><label className="label">Telepon</label><input name="phone" className="input" placeholder="08xxxxxxxxxx" /></div>
            <div className="sm:col-span-2"><label className="label">Email</label><input name="email" className="input" placeholder="nama@email.com" /></div>
            <div className="sm:col-span-2"><label className="label">Alamat</label><input name="address" className="input" placeholder="Jl. Contoh No. 123" /></div>
            <div><label className="label">Kota</label><input name="city" className="input" placeholder="Jakarta" /></div>
            <div><label className="label">Kode Pos</label><input name="postalCode" className="input" placeholder="12345" /></div>
          </form>

          <button onClick={handleConfirmPay} className="mt-4 w-full rounded-xl bg-black py-3 text-white" disabled={status === 'processing' || items.length === 0}>
            {status === 'processing' ? 'Processing…' : 'Confirm & Pay'}
          </button>
        </aside>
      </section>
    </main>
  );
}
