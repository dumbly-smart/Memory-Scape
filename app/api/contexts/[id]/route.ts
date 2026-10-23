import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

type Params = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const id = idSchema.parse((await params).id);
    const result = await pool.query(
      `SELECT c.id,c.type,c.label,c.created_at,
        (SELECT count(*)::int FROM memory_contexts mc JOIN memories m ON m.id=mc.memory_id WHERE mc.context_id=c.id AND m.archived_at IS NULL) AS memory_count,
        (SELECT to_jsonb(recent) FROM (
          SELECT m.id,m.title,m.content,m.occurred_at,m.last_strength_at,m.strength,m.location_label,m.source_url,m.is_pinned,m.is_sensitive
          FROM memory_contexts mc JOIN memories m ON m.id=mc.memory_id
          WHERE mc.context_id=c.id AND m.archived_at IS NULL
          ORDER BY m.occurred_at DESC,m.id LIMIT 100
        ) recent) AS memories,
        (SELECT to_jsonb(latest) FROM (
          SELECT m.id,m.title,m.content,m.occurred_at,m.last_strength_at
          FROM memory_contexts mc JOIN memories m ON m.id=mc.memory_id
          WHERE mc.context_id=c.id AND m.archived_at IS NULL
          ORDER BY m.occurred_at DESC,m.id LIMIT 1
        ) latest) AS resume_memory
       FROM contexts c WHERE c.id=$1`,
      [id],
    );
    if (!result.rowCount) return NextResponse.json({ error: 'Context not found' }, { status: 404 });
    const context = result.rows[0];
    return NextResponse.json({ data: { ...context, memories: context.memories ?? [] } });
  } catch (error) {
    return jsonError(error);
  }
}
