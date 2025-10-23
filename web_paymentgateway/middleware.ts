// middleware.ts
import { NextResponse, NextRequest } from "next/server";
import jwt, { JwtPayload } from "jsonwebtoken";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("token")?.value;

  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/cart");

  // Jika halaman dilindungi dan belum login → redirect ke /login?from=<pathname>
  if (isProtected && !token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Jika sudah login & mencoba buka /login atau /register
  if ((pathname === "/login" || pathname === "/register") && token) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return NextResponse.next();

    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      // 🎯 FIX: Jika ada ?from, redirect ke sana (bukan biarkan page handle)
      const from = req.nextUrl.searchParams.get("from");
      if (from) {
        return NextResponse.redirect(new URL(from, req.url));
      }

      // Tanpa ?from, redirect berdasarkan role
      if (decoded.role === "admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", req.url));
      } else {
        return NextResponse.redirect(new URL("/", req.url));
      }
    } catch {
      // Token invalid/expired → biarkan user masuk ke halaman login/register
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
    "/login",
    "/register",
  ],
};