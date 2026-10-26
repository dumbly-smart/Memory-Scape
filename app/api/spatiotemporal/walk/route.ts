import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

const schema = z.object({
  route: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(2).max(1000),
  }),
  radiusMeters: z.number().min(1).max(50000).default(100),
  from: z.string().datetime({ offset: true }),
  until: z.string().datetime({ offset: true }),
});

export async function POST(request: NextRequest) {
  try {
    const value = schema.parse(await request.json());
    const result = await pool.query(
      'SELECT * FROM spatiotemporal_memory_walk($1::jsonb,$2,$3::timestamptz,$4::timestamptz)',
      [JSON.stringify(value.route), value.radiusMeters, value.from, value.until],
    );
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return jsonError(error);
  }
}
