// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const ADMIN_PREFIX = "/admin";
const USER_PROTECTED_PREFIXES = ["/user", "/checkout", "/payment", "/thankyou"]; // <-- tambah payment & thankyou
const AUTH_COOKIE = "token";

// --- helpers ---
function withClearedTokenRedirect(req: NextRequest, to: URL | string) {
  const res = NextResponse.redirect(typeof to === "string" ? new URL(to, req.url) : to);
  // hapus cookie token biar nggak stuck dengan token jelek
  res.cookies.set(AUTH_COOKIE, "", { expires: new Date(0), path: "/" });
  return res;
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  const returnTo = encodeURIComponent(url.pathname + url.search);
  url.pathname = "/login";
  url.search = `?returnTo=${returnTo}`;
  return NextResponse.redirect(url);
}

async function verifyJWT(token: string, secret: string) {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  // opsional: cek exp kalau ada
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    throw new Error("Token expired");
  }
  return payload as { role?: string; roles?: string[]; sub?: string };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE)?.value;

  // Lewatkan middleware untuk asset/api auth/login itu sendiri
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") || // kalau API-mu butuh proteksi, atur per-route di handlernya
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // --- ADMIN protected ---
  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (!token) return redirectToLogin(req);

    const secret = process.env.JWT_SECRET;
    if (!secret) return redirectToLogin(req);

    try {
      const payload = await verifyJWT(token, secret);
      const isAdmin =
        payload.role === "admin" ||
        (Array.isArray(payload.roles) && payload.roles.includes("admin"));

      if (!isAdmin) {
        // bukan admin → pulang ke beranda
        return NextResponse.redirect(new URL("/", req.url));
      }

      return NextResponse.next();
    } catch {
      // token invalid/expired
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?returnTo=${encodeURIComponent(pathname)}`;
      return withClearedTokenRedirect(req, url);
    }
  }

  // --- USER protected (/user, /checkout, /payment, /thankyou) ---
  if (USER_PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!token) return redirectToLogin(req);

    // Untuk halaman user umum, cukup cek validitas token (tanpa cek role khusus)
    const secret = process.env.JWT_SECRET;
    if (!secret) return redirectToLogin(req);

    try {
      await verifyJWT(token, secret);
      return NextResponse.next();
    } catch {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?returnTo=${encodeURIComponent(pathname)}`;
      return withClearedTokenRedirect(req, url);
    }
  }

  // default: biarkan lewat
  return NextResponse.next();
}

// ✅ Pastikan matcher meliputi semua route yang diproteksi
export const config = {
  matcher: [
    "/admin/:path*",
    "/user/:path*",
    "/checkout/:path*",
    "/payment/:path*",   // <-- baru
    "/thankyou/:path*",  // <-- opsional tapi disarankan
  ],
};
