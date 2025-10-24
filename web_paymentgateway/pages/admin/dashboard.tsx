// pages/admin/dashboard.tsx
import useSWR from "swr";
import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from "recharts";

/* =========================
   Types
   ========================= */
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
};

type OrderRow = {
  _id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProductRow = {
  _id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  category?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiList<T> = { data: T[] };
type ApiOne<T>  = { data: T };
type StatsDaily = { date: string; total: number };
type StatsMonthly = { month: string; total: number };
type StatsResp = { daily: StatsDaily[]; monthly: StatsMonthly[] };

/* =========================
   Stable empty fallbacks (hindari referensi baru)
   ========================= */
const EMPTY_ORDERS: OrderRow[] = [];
const EMPTY_PRODUCTS: ProductRow[] = [];
const EMPTY_DAILY: StatsDaily[] = [];
const EMPTY_MONTHLY: StatsMonthly[] = [];

/* =========================
   Utils
   ========================= */

// Safely extract error message from unknown JSON
const getErrMsg = (body: unknown): string | null => {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    const msg = rec["message"];
    const err = rec["error"];
    if (typeof msg === "string") return msg;
    if (typeof err === "string") return err;
  }
  return null;
};

// Generic JSON fetcher untuk SWR
const swrJSON = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url, { cache: "no-store" });
  let body: unknown = null;
  try { body = await r.json(); } catch { /* ignore */ }
  if (!r.ok) {
    const msg = getErrMsg(body) ?? `Request failed: ${r.status}`;
    throw new Error(msg);
  }
  return body as T;
};

const idr = (n: number) =>
  n?.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

/* =========================
   Component
   ========================= */
export default function AdminDashboard() {
  /* -------- Orders -------- */
  const { data: ordersResp, error: ordersErr } =
    useSWR<ApiList<OrderRow>>("/api/admin-proxy/orders?limit=100", swrJSON);

  /* -------- Products -------- */
  const {
    data: productsResp,
    error: productsErr,
    mutate: mutateProducts,
    isLoading: productsLoading
  } = useSWR<ApiList<ProductRow>>("/api/admin-proxy/products?limit=200", swrJSON);

  /* -------- Stats -------- */
  const { data: statsResp, error: statsErr } =
    useSWR<StatsResp>("/api/admin-proxy/stats", swrJSON);

  const [form, setForm] = useState<{ name: string; price: number; description?: string; category: string }>({
    name: "",
    price: 0,
    description: "",
    category: "All",
  });
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  // helper request JSON
  async function requestJSON<T>(url: string, init?: RequestInit): Promise<T> {
    const r = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    let body: unknown = null;
    try { body = await r.json(); } catch { /* ignore */ }
    if (!r.ok) {
      const errMsg = getErrMsg(body) ?? `Request failed: ${r.status}`;
      throw new Error(errMsg);
    }
    return body as T;
  }

  async function createProduct(): Promise<void> {
    try {
      setBusy(true); setErrorMsg(null); setSuccessMsg(null);

      if (!form.name.trim()) throw new Error("Nama produk wajib diisi");
      if (!Number.isFinite(form.price) || form.price <= 0) throw new Error("Harga harus > 0");

      // Optimistic append
      const temp: ProductRow = {
        _id: `tmp-${Date.now()}`,
        name: form.name,
        price: form.price,
        description: form.description || undefined,
        category: form.category !== "All" ? form.category : undefined,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        imageUrl: undefined,
      };

      await mutateProducts(prev => ({ data: [ ...(prev?.data ?? []), temp ] }), { revalidate: false });

      // ✅ create via /api/admin-proxy
      await requestJSON<ApiOne<ProductRow>>("/api/admin-proxy/products", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          price: form.price,
          description: form.description || undefined,
          category: form.category !== "All" ? form.category : undefined,
        }),
      });

      setForm({ name: "", price: 0, description: "", category: "All" });
      setSuccessMsg("Produk berhasil dibuat");
      // revalidate
      await mutateProducts();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Gagal membuat produk");
      // rollback optimistic (filter tmp)
      await mutateProducts(prev => ({ data: (prev?.data ?? []).filter(p => !p._id.startsWith("tmp-")) }), { revalidate: false });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: ProductRow): Promise<void> {
    try {
      setBusy(true); setErrorMsg(null); setSuccessMsg(null);

      // optimistic toggle
      await mutateProducts(prev => ({
        data: (prev?.data ?? []).map(x =>
          x._id === p._id ? { ...x, isActive: !x.isActive, updatedAt: new Date().toISOString() } : x
        ),
      }), { revalidate: false });

      await requestJSON<ApiOne<ProductRow>>(`/api/admin-proxy/${encodeURIComponent(p._id)}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !p.isActive }),
      });

      setSuccessMsg("Status produk diperbarui");
      await mutateProducts();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Gagal mengubah status");
      // rollback
      await mutateProducts();
    } finally {
      setBusy(false);
    }
  }

  /* =========================
     Memoized base arrays (fix exhaustive-deps)
     ========================= */
  const orders = useMemo(
    () => (ordersResp?.data ?? EMPTY_ORDERS),
    [ordersResp?.data]
  );

  const products = useMemo(
    () => (productsResp?.data ?? EMPTY_PRODUCTS),
    [productsResp?.data]
  );

  /* =========================
     Derivations
     ========================= */
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return ["All", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const cat = categoryFilter;
    return products.filter(p => (cat === "All" ? true : (p.category ?? "Uncategorized") === cat));
  }, [products, categoryFilter]);

  const totalRevenue = useMemo(() => {
    return orders.reduce((acc, o) => acc + (o.paymentStatus === "PAID" ? o.totalAmount : 0), 0);
  }, [orders]);

  const totalPaidOrders = useMemo(() => {
    return orders.filter(o => o.paymentStatus === "PAID").length;
  }, [orders]);

  const last7Daily = statsResp?.daily ?? EMPTY_DAILY;
  const last12Months = statsResp?.monthly ?? EMPTY_MONTHLY;

  return (
    <div className="p-6 space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-gray-500">Ringkasan penjualan, produk, dan statistik.</p>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4 shadow-sm">
          <div className="text-gray-500 text-sm">Pendapatan (PAID)</div>
          <div className="text-2xl font-bold">{idr(totalRevenue)}</div>
        </div>
        <div className="rounded-2xl border p-4 shadow-sm">
          <div className="text-gray-500 text-sm">Order Terbayar</div>
          <div className="text-2xl font-bold">{totalPaidOrders}</div>
        </div>
        <div className="rounded-2xl border p-4 shadow-sm">
          <div className="text-gray-500 text-sm">Produk Aktif</div>
          <div className="text-2xl font-bold">{products.filter(p => p.isActive).length}</div>
        </div>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Penjualan Harian (7 hari)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last7Daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="total" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border p-4 shadow-sm">
          <h2 className="font-semibold mb-2">Penjualan Bulanan (12 bulan)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last12Months}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Produk</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Filter kategori:</label>
            <select
              className="border rounded-lg px-2 py-1"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Nama</th>
                <th className="text-left p-3">Kategori</th>
                <th className="text-right p-3">Harga</th>
                <th className="text-center p-3">Status</th>
                <th className="text-right p-3">Diupdate</th>
                <th className="text-right p-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {productsLoading && (
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">Memuat...</td></tr>
              )}
              {!productsLoading && filteredProducts.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">Tidak ada produk</td></tr>
              )}
              {filteredProducts.map(p => (
                <tr key={p._id} className="border-t">
                  <td className="p-3">{p.name}</td>
                  <td className="p-3">{p.category ?? "-"}</td>
                  <td className="p-3 text-right">{idr(p.price)}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-lg text-xs ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {p.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="p-3 text-right">{new Date(p.updatedAt).toLocaleString("id-ID")}</td>
                  <td className="p-3 text-right">
                    <button
                      className="px-3 py-1 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => toggleActive(p)}
                      disabled={busy}
                    >
                      {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Create new product */}
        <div className="rounded-2xl border p-4 space-y-3">
          <h3 className="font-semibold">Tambah Produk</h3>
          {errorMsg && <div className="text-sm text-red-600">{errorMsg}</div>}
          {successMsg && <div className="text-sm text-green-600">{successMsg}</div>}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Nama produk"
              value={form.name}
              onChange={(e) => setForm(v => ({ ...v, name: e.target.value }))}
            />
            <input
              type="number"
              className="border rounded-lg px-3 py-2"
              placeholder="Harga"
              value={form.price}
              onChange={(e) => setForm(v => ({ ...v, price: Number(e.target.value) }))}
            />
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Deskripsi (opsional)"
              value={form.description}
              onChange={(e) => setForm(v => ({ ...v, description: e.target.value }))}
            />
            <select
              className="border rounded-lg px-3 py-2"
              value={form.category}
              onChange={(e) => setForm(v => ({ ...v, category: e.target.value }))}
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
              onClick={createProduct}
              disabled={busy}
            >
              Simpan
            </button>
            <button
              className="px-4 py-2 rounded-xl border disabled:opacity-50"
              onClick={() => setForm({ name: "", price: 0, description: "", category: "All" })}
              disabled={busy}
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      {/* Orders */}
      <section className="space-y-4">
        <h2 className="font-semibold">Order Terbaru</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Items</th>
                <th className="text-right p-3">Total</th>
                <th className="text-center p-3">Status</th>
                <th className="text-right p-3">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {ordersErr && (
                <tr><td colSpan={6} className="p-4 text-center text-red-600">Gagal memuat orders</td></tr>
              )}
              {!ordersErr && orders.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">Belum ada data</td></tr>
              )}
              {orders.map(o => (
                <tr key={o._id} className="border-t">
                  <td className="p-3">{o._id}</td>
                  <td className="p-3">{o.userId}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      {o.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between gap-4">
                          <span>{it.name} × {it.quantity}</span>
                          <span className="text-right">{idr(it.price * it.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right">{idr(o.totalAmount)}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-lg text-xs ${
                      o.paymentStatus === "PAID" ? "bg-green-100 text-green-700"
                        : o.paymentStatus === "PENDING" ? "bg-yellow-100 text-yellow-700"
                        : o.paymentStatus === "FAILED" ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="p-3 text-right">{new Date(o.createdAt).toLocaleString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Errors */}
      {(productsErr || statsErr) && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700">
          {productsErr && <div>Gagal memuat produk.</div>}
          {statsErr && <div>Gagal memuat statistik.</div>}
        </div>
      )}
    </div>
  );
}
