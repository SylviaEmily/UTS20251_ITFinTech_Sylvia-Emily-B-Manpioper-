import { useState, useMemo } from "react";
import { useRouter } from "next/router";

export default function LoginPage() {
  const [step, setStep] = useState<"login" | "otp">("login");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");

  const router = useRouter();

  // === tambahan: ambil & DECODE ?returnTo=... agar redirect balik ke tujuan awal ===
  const rawReturnTo = useMemo(() => {
    const rt = router.query.returnTo;
    return typeof rt === "string" ? rt : "";
  }, [router.query.returnTo]);

  const decodedReturnTo = useMemo(() => {
    try {
      return rawReturnTo ? decodeURIComponent(rawReturnTo) : "";
    } catch {
      return "";
    }
  }, [rawReturnTo]);

  // === STEP 1: Kirim email/phone + password untuk mendapatkan OTP ===
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrPhone, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setPhone(data.phone);
        setMessage("Kode OTP telah dikirim ke WhatsApp kamu 📱");
        setStep("otp");
      } else {
        setMessage(data.message || "Login gagal");
      }
    } catch (err) {
      console.error(err);
      setMessage("Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  };

  // === STEP 2: Verifikasi OTP ===
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("Login berhasil! 🎉");

        // simpan token (tetap seperti kode lama) + cookie agar middleware bisa membaca
        localStorage.setItem("token", data.token);
        // NOTE: lebih aman jika server yang set HttpOnly cookie; ini fallback sementara
        document.cookie = `token=${data.token}; path=/; max-age=7200; samesite=lax`;

        // redirect: utamakan returnTo (yang sudah di-decode). jika tidak ada, pakai default by role
        let dest = decodedReturnTo || (data.role === "admin" ? "/admin/dashboard" : "/");

        // proteksi sederhana: kalau user biasa diarahkan ke /admin/*, arahkan ke beranda
        if (data.role !== "admin" && dest.startsWith("/admin")) dest = "/";

        await router.replace(dest);
        return;
      } else {
        setMessage(data.message || "Verifikasi OTP gagal");
      }
    } catch (err) {
      console.error(err);
      setMessage("Terjadi kesalahan server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          {step === "login" ? "Login ke Akunmu" : "Verifikasi OTP"}
        </h1>

        {message && (
          <p
            className={`text-center mb-4 ${
              message.includes("berhasil") || message.includes("dikirim")
                ? "text-green-600"
                : "text-red-500"
            }`}
          >
            {message}
          </p>
        )}

        {step === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Email / Nomor WA</label>
              <input
                type="text"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                className="w-full p-2 border rounded-lg"
                placeholder="contoh: 08123456789 atau email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded-lg"
                placeholder="Masukkan password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
            >
              {loading ? "Mengirim OTP..." : "Login"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Kode OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full p-2 border rounded-lg text-center tracking-widest"
                placeholder="Masukkan 6 digit kode"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
            >
              {loading ? "Memverifikasi..." : "Verifikasi OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <button
            onClick={() => setStep("login")}
            className="mt-4 w-full text-sm text-blue-500 hover:underline"
          >
            Kembali ke Login
          </button>
        )}
      </div>
    </div>
  );
}
