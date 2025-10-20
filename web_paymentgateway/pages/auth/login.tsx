import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", 
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Login failed");

      // ✅ Cookie token sudah diset oleh server (HttpOnly) di API login.
      //    Tidak perlu set document.cookie di sini.
      if (data.role === "admin") {
        window.location.href = "/admin/dashboard";
      } else {
        window.location.href = "/";
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Login failed";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm p-6 rounded-xl border shadow">
        <h1 className="text-xl font-semibold mb-4">Login</h1>

        <label className="block mb-2 text-sm">Email</label>
        <input
          className="w-full border rounded px-3 py-2 mb-3"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          required
        />

        <label className="block mb-2 text-sm">Password</label>
        <input
          className="w-full border rounded px-3 py-2 mb-4"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        {err && <p className="text-red-600 text-sm mb-3">{err}</p>}

        <button
          disabled={busy}
          className="w-full rounded bg-blue-600 text-white py-2 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Login"}
        </button>
      </form>
    </div>
  );
}
