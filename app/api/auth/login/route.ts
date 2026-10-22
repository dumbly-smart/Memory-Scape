import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSessionToken, getAuthConfiguration, AUTH_COOKIE_NAME, SESSION_DURATION_SECONDS_VALUE, verifyPassword } from '@/lib/auth';
import { pool } from '@/lib/db/pool';

const loginSchema = z.object({ password: z.string().min(1).max(512) });

export async function POST(request: NextRequest) {
  const auth = getAuthConfiguration();
  if (auth.mode !== 'enabled') return NextResponse.json({ error: auth.mode === 'disabled' ? 'Authentication is not enabled' : 'Authentication configuration is incomplete' }, { status: 503 });
  try {
    const { password } = loginSchema.parse(await request.json());
    const attempt = await pool.query('SELECT * FROM take_workspace_login_attempt()');
    if (!attempt.rows[0].allowed) {
      const response = NextResponse.json({ error: 'Too many sign-in attempts. Try again later.' }, { status: 429 });
      response.headers.set('Retry-After', String(attempt.rows[0].retry_after_seconds));
      return response;
    }
    if (!await verifyPassword(password, auth.password)) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    await pool.query('SELECT clear_workspace_login_limit()');
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS_VALUE;
    const token = await createSessionToken(expiresAt, auth.secret);
    const response = NextResponse.json({ authenticated: true, expiresAt });
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS_VALUE,
    });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    return NextResponse.json({ error: 'Login could not be completed' }, { status: 500 });
  }
}
