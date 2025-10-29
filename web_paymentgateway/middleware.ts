// middleware.ts
import { NextResponse, NextRequest } from "next/server";
import jwt, { JwtPayload } from "jsonwebtoken";

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const token = req.cookies.get("token")?.value;

  // ✅ tambahkan /payment sebagai route yang wajib login
  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/payment");

  // Belum login tapi akses halaman terlindungi → arahkan ke login + bawa ?from
  if (isProtected && !token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname + (req.nextUrl.search || ""));
    return NextResponse.redirect(url);
  }

  // Sudah login tapi buka /login atau /register
  if ((pathname === "/login" || pathname === "/register") && token) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return NextResponse.next();

    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      // Kalau ada ?from (mis. /login?from=/checkout), kirim balik ke sana
      const from = req.nextUrl.searchParams.get("from");
      if (from) {
        return NextResponse.redirect(new URL(from, req.url));
      }

      // Kalau tidak ada ?from, arahkan berdasar role
      if (decoded.role === "admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", req.url));
      } else {
        return NextResponse.redirect(new URL("/checkout", req.url));
      }
    } catch {
      // token invalid/expired → biarkan user lanjut ke /login /register
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/checkout/:path*",
    "/cart/:path*",
    "/payment/:path*", // ✅ proteksi payment
    "/login",
    "/register",
  ],
};
