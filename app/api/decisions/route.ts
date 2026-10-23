import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

const uuid = z.string().uuid();
const create = z.object({
  memoryId: uuid.optional(),
  contextId: uuid.optional(),
  choice: z.string().trim().min(1).max(1000),
  rationale: z.string().trim().min(1).max(10000),
  alternatives: z.string().max(10000).default(''),
  decidedAt: z.string().datetime().optional(),
  revisitAt: z.string().datetime().nullable().optional(),
}).refine(v => v.memoryId || v.contextId, { message: 'A decision must be linked to a memory or context' })
  .refine(v => !v.revisitAt || !v.decidedAt || new Date(v.revisitAt) >= new Date(v.decidedAt), { message: 'Revisit date must be on or after the decision date', path: ['revisitAt'] });

export async function GET(request: NextRequest) {
  try {
    const filter = z.object({ memoryId: uuid.optional(), contextId: uuid.optional() }).parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await pool.query(
      `SELECT d.*,m.title AS memory_title,c.label AS context_label,c.type AS context_type
       FROM decisions d LEFT JOIN memories m ON m.id=d.memory_id LEFT JOIN contexts c ON c.id=d.context_id
       WHERE ($1::uuid IS NULL OR d.memory_id=$1) AND ($2::uuid IS NULL OR d.context_id=$2)
       ORDER BY d.decided_at DESC,d.created_at DESC LIMIT 200`,
      [filter.memoryId ?? null,filter.contextId ?? null],
    );
    return NextResponse.json({ data: result.rows });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const value = create.parse(await request.json());
    const result = await pool.query(
      `INSERT INTO decisions(choice,rationale,alternatives,decided_at,revisit_at,memory_id,context_id)
       VALUES($1,$2,$3,coalesce($4::timestamptz,now()),$5,$6,$7) RETURNING *`,
      [value.choice,value.rationale,value.alternatives,value.decidedAt ?? null,value.revisitAt ?? null,value.memoryId ?? null,value.contextId ?? null],
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
