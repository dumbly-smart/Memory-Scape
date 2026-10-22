import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getAuthConfiguration, verifySession } from '@/lib/auth';

const publicApiPaths = new Set(['/api/auth/login', '/api/auth/logout', '/api/auth/status', '/api/health']);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/_next/') || pathname === '/favicon.ico' || publicApiPaths.has(pathname)) return NextResponse.next();
  const auth = getAuthConfiguration();
  if (auth.mode === 'disabled') return pathname === '/login' ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  if (auth.mode === 'misconfigured') {
    if (pathname === '/login') return NextResponse.next();
    return NextResponse.json({ error: 'Set both MEMORYSCAPE_PASSWORD (at least 12 characters) and MEMORYSCAPE_SESSION_SECRET (at least 32 characters)' }, { status: 503 });
  }
  const valid = await verifySession(request.cookies.get(AUTH_COOKIE_NAME)?.value, auth.secret);
  if (pathname === '/login') return valid ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  if (valid) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const login = new URL('/login', request.url);
  login.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
