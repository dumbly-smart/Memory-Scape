import { NextResponse } from 'next/server';
import { pool } from '@/lib/db/pool';
export async function GET() {
  try { const result = await pool.query('SELECT version() AS postgres, PostGIS_Full_Version() AS postgis'); return NextResponse.json({ status: 'ok', database: result.rows[0] }); }
  catch { return NextResponse.json({ status: 'unavailable', error: 'Database connection failed' }, { status: 503 }); }
}
