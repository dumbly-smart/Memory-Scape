import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export function jsonError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid request', details: error.flatten() }, { status: 400 });
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message : 'Request failed';
  const status = code === 'P0002' ? 404 : code === '23505' ? 409 : ['23502', '23503', '23514', 'P0001'].includes(code ?? '') || code?.startsWith('22') ? 400 : 500;
  return NextResponse.json({ error: status === 500 ? 'Internal server error' : message }, { status });
}
