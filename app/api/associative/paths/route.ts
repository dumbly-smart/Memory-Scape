import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

const schema = z.object({
  seedId: z.guid(),
  targetId: z.guid(),
  depth: z.number().int().min(1).max(3).default(3),
  threshold: z.number().min(0).max(1).default(0.01),
  limit: z.number().int().min(1).max(20).default(5),
});

export async function POST(request: NextRequest) {
  try {
    const value = schema.parse(await request.json());
    const result = await pool.query<{ path_ids: string[] }>(
      'SELECT * FROM associative_recall_paths($1::uuid,$2::uuid,$3,$4,$5)',
      [value.seedId, value.targetId, value.depth, value.threshold, value.limit],
    );
    const ids = [...new Set(result.rows.flatMap(row => row.path_ids))];
    const names = ids.length
      ? await pool.query<{ id: string; title: string }>('SELECT id,title FROM memories WHERE id=ANY($1::uuid[])', [ids])
      : { rows: [] as Array<{ id: string; title: string }> };
    const titleById = new Map(names.rows.map(row => [row.id, row.title]));
    return NextResponse.json({ data: result.rows.map(row => ({
      ...row,
      path_titles: row.path_ids.map(id => titleById.get(id) ?? id),
    })) });
  } catch (error) {
    return jsonError(error);
  }
}
