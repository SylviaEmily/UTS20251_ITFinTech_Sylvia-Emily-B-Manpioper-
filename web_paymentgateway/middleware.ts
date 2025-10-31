// middleware.ts (Edge-safe)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PROTECTED_PATHS = ['/checkout', '/payment', '/profile', '/orders', '/cart'];

function isSafeInternalPath(p?: string | null) {
  if (!p) return false;
  if (!p.startsWith('/') || p.startsWith('//')) return false;
  const l = p.toLowerCase();
  return !(l.includes('http://') || l.includes('https://'));
}

async function verifyJWT(token: string, secret: string) {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
  return payload as { role?: string; exp?: number; [k: string]: any };
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get('token')?.value?.trim() || null;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = pathname === '/login' || pathname === '/register';

  // 1) Belum login & akses protected → paksa login
  if (isProtected && !token) {
    const url = new URL('/login', req.url);
    url.searchParams.set('from', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  // 2) Ada token → verifikasi dengan JOSE (Edge-safe)
  if (isProtected && token) {
    const secret = process.env.JWT_SECRET || '';
    try {
      await verifyJWT(token, secret);
      return NextResponse.next(); // valid → lanjut
    } catch {
      // invalid/expired → bersihkan cookie & ke login
      const url = new URL('/login', req.url);
      url.searchParams.set('from', pathname + (search || ''));
      const res = NextResponse.redirect(url);
      res.cookies.delete('token');
      return res;
    }
  }

  // 3) Sudah login tapi buka /login /register → lempar balik
  if (isAuthPage && token) {
    const secret = process.env.JWT_SECRET || '';
    try {
      const payload = await verifyJWT(token, secret);
      const from = req.nextUrl.searchParams.get('from');
      const preferred =
        (isSafeInternalPath(from) && from) ||
        (payload.role === 'admin' ? '/admin/dashboard' : '/checkout');
      return NextResponse.redirect(new URL(preferred, req.url));
    } catch {
      // token invalid → biarkan user melihat halaman login/register
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/checkout/:path*',
    '/payment/:path*',
    '/profile/:path*',
    '/orders/:path*',
    '/cart/:path*',
    '/login',
    '/register',
  ],
};
