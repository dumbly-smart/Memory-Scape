import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

const id = z.string().uuid();
const filters = z.object({ memoryId: id.optional(), contextId: id.optional(), status: z.enum(['open','done','dismissed']).optional() });
const create = z.object({ title: z.string().trim().min(1).max(240), description: z.string().max(4000).default(''), dueAt: z.string().datetime().nullable().optional(), memoryId: id.optional(), contextId: id.optional() }).refine(v => v.memoryId || v.contextId, { message: 'A follow-up must be linked to a memory or context' });

export async function GET(request: NextRequest) {
  try {
    const query = filters.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await pool.query(
      `SELECT f.*,m.title AS memory_title,c.label AS context_label,c.type AS context_type
       FROM follow_ups f LEFT JOIN memories m ON m.id=f.memory_id LEFT JOIN contexts c ON c.id=f.context_id
       WHERE ($1::uuid IS NULL OR f.memory_id=$1) AND ($2::uuid IS NULL OR f.context_id=$2) AND ($3::text IS NULL OR f.status=$3)
       ORDER BY CASE WHEN f.status='open' THEN 0 ELSE 1 END, f.due_at NULLS LAST, f.created_at DESC LIMIT 200`,
      [query.memoryId ?? null, query.contextId ?? null, query.status ?? null],
    );
    return NextResponse.json({ data: result.rows });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const value = create.parse(await request.json());
    const result = await pool.query(
      `INSERT INTO follow_ups(title,description,due_at,memory_id,context_id)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [value.title,value.description,value.dueAt ?? null,value.memoryId ?? null,value.contextId ?? null],
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
