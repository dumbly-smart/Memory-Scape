import { NextResponse } from 'next/server';
import { getAuthConfiguration } from '@/lib/auth';

export async function GET() {
  const auth = getAuthConfiguration();
  return NextResponse.json({ enabled: auth.mode === 'enabled', misconfigured: auth.mode === 'misconfigured' });
}
