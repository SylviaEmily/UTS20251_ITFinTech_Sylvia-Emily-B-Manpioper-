import { NextResponse, NextRequest } from "next/server";
import jwt, { JwtPayload } from "jsonwebtoken";

// Pastikan middleware dijalankan di semua route yang kamu butuh proteksi
export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const url = req.nextUrl.pathname;

  // Jika belum login dan mengakses /admin, arahkan ke login
  if (url.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // ✅ Pastikan JWT_SECRET tidak undefined
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("Missing JWT_SECRET in environment variables");
      return NextResponse.redirect(new URL("/login", req.url));
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      if (decoded.role !== "admin") {
        // Jika bukan admin, redirect ke homepage
        return NextResponse.redirect(new URL("/", req.url));
      }
    } catch (error) {
      console.error("Invalid or expired token:", error);
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // Jika URL dimulai dengan /user (misal halaman profil user), pastikan token ada
  if (url.startsWith("/user") || url.startsWith("/checkout")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // Jika semua valid, lanjutkan request
  return NextResponse.next();
}

// ✅ Tentukan halaman mana yang akan dilindungi
export const config = {
  matcher: ["/admin/:path*", "/user/:path*", "/checkout/:path*"],
};
