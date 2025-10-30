import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Dapatkan token dari cookies
  const token = request.cookies.get('token')?.value
  
  // Path yang dilindungi (memerlukan login)
  const protectedPaths = ['/checkout', '/profile', '/orders']
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  // Jika mengakses path yang dilindungi dan belum login
  if (isProtectedPath && !token) {
    // Redirect ke login dengan parameter 'from' untuk kembali setelah login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

// Konfigurasi matcher untuk middleware
export const config = {
  matcher: [
    '/checkout/:path*',
    '/profile/:path*', 
    '/orders/:path*',
  ]
}