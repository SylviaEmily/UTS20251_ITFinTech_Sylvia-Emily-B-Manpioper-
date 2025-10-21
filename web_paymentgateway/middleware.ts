import { NextResponse, type NextRequest } from "next/server";
import jwt, { JwtPayload } from "jsonwebtoken";

// helper: redirect ke /login sambil membawa returnTo
function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  const returnTo = encodeURIComponent(url.pathname + url.search);
  url.pathname = "/login";
  url.search = `?returnTo=${returnTo}`;
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value || "";
  const path = req.nextUrl.pathname;

  // Proteksi halaman ADMIN
  if (path.startsWith("/admin")) {
    if (!token) {
      return redirectToLogin(req);
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("Missing JWT_SECRET in environment variables");
      return redirectToLogin(req);
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload & { role?: string };
      if (decoded.role !== "admin") {
        // bukan admin -> ke homepage
        return NextResponse.redirect(new URL("/", req.url));
      }
    } catch (err) {
      console.error("Invalid or expired token:", err);
      return redirectToLogin(req);
    }
  }

  // Proteksi halaman USER (contoh: profil/checkout)
  if (path.startsWith("/user") || path.startsWith("/checkout")) {
    if (!token) {
      return redirectToLogin(req);
    }
    // token ada -> tidak cek role spesifik (user/admin boleh akses halaman umum)
  }

  // lanjutkan request
  return NextResponse.next();
}

// ✅ Halaman yang dilindungi (tetap sama)
export const config = {
  matcher: ["/admin/:path*", "/user/:path*", "/checkout/:path*"],
};
