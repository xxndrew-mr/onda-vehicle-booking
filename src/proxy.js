import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE } from './lib/auth';

/**
 * Proteksi seluruh aplikasi (Next.js 16: proxy.js menggantikan middleware.js,
 * berjalan di Node runtime). Tanpa session valid:
 * - request API  → 401 JSON
 * - request page → redirect ke SSO Lark (di dalam klien Lark berlangsung
 *   mulus tanpa layar login, sesuai perilaku auto-consent internal app).
 */
export async function proxy(request) {
  const { pathname, search } = request.nextUrl;

  const secret = process.env.SESSION_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  let authenticated = false;
  if (token && secret && secret.length >= 32) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
      authenticated = true;
    } catch {
      // token kedaluwarsa/tidak valid → perlakukan sebagai belum login
    }
  }

  if (authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { message: 'Belum login. Silakan buka aplikasi lewat Lark.' },
      { status: 401 }
    );
  }

  const loginUrl = new URL('/api/auth/login', request.url);
  loginUrl.searchParams.set('redirect_to', `${pathname}${search || ''}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Semua route KECUALI: alur auth itu sendiri, halaman error auth, dan aset statis.
  matcher: ['/((?!api/auth/|auth-error|_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
};
