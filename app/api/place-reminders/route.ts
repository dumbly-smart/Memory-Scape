import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

const create = z.object({
  memoryId: z.guid(), title: z.string().trim().min(1).max(240),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(1).max(50000).default(100), locationLabel: z.string().max(240).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const value = create.parse(await request.json());
    const result = await pool.query(
      `INSERT INTO place_reminders(memory_id,title,location,location_label,radius_m)
       SELECT m.id,$2,ST_SetSRID(ST_MakePoint($4,$3),4326)::geography,$5,$6
       FROM memories m WHERE m.id=$1 AND NOT m.is_sensitive AND m.archived_at IS NULL RETURNING *`,
      [value.memoryId,value.title,value.latitude,value.longitude,value.locationLabel ?? null,value.radiusMeters],
    );
    if (!result.rowCount) return NextResponse.json({ error: 'Memory not found or excluded from place reminders' }, { status: 404 });
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
