// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// redirect ke /login sambil membawa returnTo
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
  return payload as { role?: string };
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value || "";
  const path = req.nextUrl.pathname;

  // Proteksi halaman ADMIN
  if (path.startsWith("/admin")) {
    if (!token) return redirectToLogin(req);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return redirectToLogin(req);

    try {
      const payload = await verifyJWT(token, jwtSecret);
      if (payload.role !== "admin") {
        return NextResponse.redirect(new URL("/", req.url));
      }
    } catch {
      return redirectToLogin(req);
    }
  }

  // Proteksi halaman USER (contoh: profil/checkout)
  if (path.startsWith("/user") || path.startsWith("/checkout")) {
    if (!token) return redirectToLogin(req);
    // token ada -> tidak cek role spesifik (user/admin boleh akses halaman umum)
  }

  // lanjutkan request
  return NextResponse.next();
}

// ✅ Halaman yang dilindungi (tetap sama)
export const config = {
  matcher: ["/admin/:path*", "/user/:path*", "/checkout/:path*"],
};
