// pages/register.tsx
import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

type FormState = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: "user" | "admin";        // 🔹 tambah role
  adminKey?: string;             // 🔹 secret untuk admin
};

function normalizePhoneClient(input: string) {
  let p = input.replace(/\D/g, "");
  if (p.startsWith("08")) p = "62" + p.slice(1);
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("+62")) p = p.replace("+", "");
  return p;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "user",
    adminKey: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setSubmitting(true);

    try {
      if (form.password !== form.confirmPassword) {
        setMsg("Konfirmasi password tidak sama");
        setSubmitting(false);
        return;
      }

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: normalizePhoneClient(form.phone),
        password: form.password,
        role: form.role,
        // Kirim adminKey hanya kalau role=admin
        adminKey: form.role === "admin" ? form.adminKey : undefined,
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(data.message || "Registrasi gagal");
      } else {
        setMsg("Registrasi berhasil! Mengarahkan ke halaman login…");
        setTimeout(() => router.push("/login"), 1200);
      }
    } catch (err) {
      console.error(err);
      setMsg("Terjadi kesalahan server");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow">
        <h1 className="text-2xl font-semibold mb-6 text-center">Buat Akun Baru</h1>

        {msg && (
          <p
            className={`mb-4 text-center ${
              msg.toLowerCase().includes("berhasil") ? "text-green-600" : "text-red-500"
            }`}
          >
            {msg}
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Role</label>
            <select
              name="role"
              value={form.role}
              onChange={onChange}
              className="w-full border rounded-lg p-2"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            {form.role === "admin" && (
              <div className="mt-2">
                <label className="block text-sm font-medium">Admin Invite Key</label>
                <input
                  name="adminKey"
                  value={form.adminKey}
                  onChange={onChange}
                  className="w-full border rounded-lg p-2"
                  placeholder="Masukkan kunci admin"
                  required={form.role === "admin"}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Hanya admin yang punya kunci ini. Minta ke owner/superadmin.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">Nama</label>
            <input
              name="name"
              value={form.name}
              onChange={onChange}
              className="w-full border rounded-lg p-2"
              placeholder="Nama lengkap"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              className="w-full border rounded-lg p-2"
              placeholder="email@contoh.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Nomor WhatsApp</label>
            <input
              name="phone"
              value={form.phone}
              onChange={onChange}
              className="w-full border rounded-lg p-2"
              placeholder="08xxxx atau 628xxxx"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Gunakan nomor aktif. Sistem akan kirim OTP via WhatsApp saat login.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              className="w-full border rounded-lg p-2"
              placeholder="Minimal 6 karakter"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Konfirmasi Password</label>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={onChange}
              className="w-full border rounded-lg p-2"
              placeholder="Ulangi password"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
          >
            {submitting ? "Mendaftarkan…" : "Daftar"}
          </button>
        </form>

        <p className="text-sm text-center mt-4">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
