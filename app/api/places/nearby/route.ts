import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

const querySchema = z.object({ latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180), radiusMeters: z.coerce.number().int().min(1).max(50000).default(1000) });

export async function GET(request: NextRequest) {
  try {
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await pool.query(
      `WITH origin AS (SELECT ST_SetSRID(ST_MakePoint($2,$1),4326)::geography AS point), candidates AS (
         SELECT 'memory'::text AS kind,m.id,m.title,m.content,m.location_label,ST_Distance(m.location,o.point) AS distance_m,m.occurred_at,m.strength,m.is_pinned
         FROM memories m CROSS JOIN origin o
         WHERE m.location IS NOT NULL AND NOT m.is_sensitive AND m.archived_at IS NULL AND ST_DWithin(m.location,o.point,$3)
         UNION ALL
         SELECT 'reminder'::text AS kind,r.id,r.title,m.content,r.location_label,ST_Distance(r.location,o.point) AS distance_m,m.occurred_at,m.strength,m.is_pinned
         FROM place_reminders r JOIN memories m ON m.id=r.memory_id CROSS JOIN origin o
         WHERE r.status='active' AND NOT m.is_sensitive AND m.archived_at IS NULL AND ST_DWithin(r.location,o.point,r.radius_m)
       ) SELECT * FROM candidates ORDER BY distance_m,kind,id LIMIT 200`,
      [query.latitude,query.longitude,query.radiusMeters],
    );
    return NextResponse.json({ data: result.rows, origin: { latitude: query.latitude, longitude: query.longitude, radiusMeters: query.radiusMeters }, generatedAt: new Date().toISOString() });
  } catch (error) { return jsonError(error); }
}
