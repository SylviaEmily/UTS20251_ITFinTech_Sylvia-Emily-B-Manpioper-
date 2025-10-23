import useSWR from "swr";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from "recharts";

const authHeader = { "x-admin-key": process.env.NEXT_PUBLIC_ADMIN_KEY || "" };
const fetcher = (url: string) => fetch(url, { headers: authHeader }).then(r => r.json());
const idr = (n: number) => n?.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default function AdminDashboard() {
  const { data: ordersResp } = useSWR("/api/admin/orders?limit=100", fetcher);
  const orders = ordersResp?.data ?? [];

  const { data: statsResp } = useSWR("/api/admin/stats", fetcher);
  const daily = statsResp?.daily ?? [];
  const monthly = statsResp?.monthly ?? [];

  const { data: productsResp, mutate: refreshProducts } = useSWR("/api/admin/products", fetcher);
  const products = productsResp?.data ?? [];

  const [form, setForm] = useState({ name: "", price: 0, description: "", category: "All" });

  async function createProduct() {
    await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify(form),
    });
    setForm({ name: "", price: 0, description: "", category: "All" });
    refreshProducts();
  }

  async function toggleActive(p: any) {
    await fetch(`/api/admin/products/${p._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    refreshProducts();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/products/${id}`, { method: "DELETE", headers: authHeader });
    refreshProducts();
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders */}
        <div className="bg-white rounded-2xl shadow p-4 lg:col-span-2">
          <h2 className="font-semibold mb-3">Checkout Terbaru</h2>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4">Items</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => (
                  <tr key={o._id} className="border-b last:border-none">
                    <td className="py-2 pr-4">{new Date(o.createdAt).toLocaleString("id-ID")}</td>
                    <td className="py-2 pr-4">
                      {o.items?.map((it: any) => `${it.name} x${it.qty}`).join(", ")}
                    </td>
                    <td className="py-2 pr-4">{idr(o.total)}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-1 rounded text-xs
                        ${o.paymentStatus === "PAID" ? "bg-green-100 text-green-700" :
                          o.paymentStatus === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-700"}`}>
                        {o.paymentStatus === "PAID" ? "Lunas" :
                         o.paymentStatus === "PENDING" ? "Waiting Payment" : o.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
                {!orders.length && <tr><td className="py-3 text-gray-500" colSpan={4}>Belum ada order</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily revenue */}
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-3">Omset Harian</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v: number) => idr(v)} />
                <Line type="monotone" dataKey="total" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Monthly revenue */}
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-3">Omset Bulanan</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v: number) => idr(v)} />
                <Bar dataKey="total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Produk CRUD */}
        <div className="bg-white rounded-2xl shadow p-4 lg:col-span-2">
          <h2 className="font-semibold mb-3">Produk</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <input className="border rounded p-2" placeholder="Nama"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input className="border rounded p-2" placeholder="Harga" type="number"
              value={form.price} onChange={e => setForm(f => ({ ...f, price: +e.target.value }))} />
            <input className="border rounded p-2 md:col-span-2" placeholder="Deskripsi"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <button onClick={createProduct} className="bg-blue-600 text-white rounded px-4">Tambah</button>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Nama</th>
                  <th className="py-2 pr-4">Harga</th>
                  <th className="py-2 pr-4">Kategori</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p: any) => (
                  <tr key={p._id} className="border-b last:border-none">
                    <td className="py-2 pr-4">{p.name}</td>
                    <td className="py-2 pr-4">{idr(p.price)}</td>
                    <td className="py-2 pr-4">{p.category}</td>
                    <td className="py-2 pr-4">{p.isActive ? "Aktif" : "Nonaktif"}</td>
                    <td className="py-2 pr-4 flex gap-2">
                      <button onClick={() => toggleActive(p)} className="px-3 py-1 rounded bg-gray-200">
                        {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button onClick={() => remove(p._id)} className="px-3 py-1 rounded bg-red-600 text-white">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
                {!products.length && <tr><td className="py-3 text-gray-500" colSpan={5}>Belum ada produk</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
