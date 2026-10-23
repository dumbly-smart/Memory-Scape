import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

type Params = { params: Promise<{ id: string }> };
const patch = z.object({ choice: z.string().trim().min(1).max(1000).optional(), rationale: z.string().trim().min(1).max(10000).optional(), alternatives: z.string().max(10000).optional(), decidedAt: z.string().datetime().optional(), revisitAt: z.string().datetime().nullable().optional() }).refine(value => Object.keys(value).length > 0, { message: 'At least one field is required' });

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const id = z.string().uuid().parse((await params).id);
    const value = patch.parse(await request.json());
    const result = await pool.query(
      `UPDATE decisions SET choice=coalesce($2,choice),rationale=coalesce($3,rationale),alternatives=coalesce($4,alternatives),
       decided_at=coalesce($5,decided_at),revisit_at=CASE WHEN $6::boolean THEN $7::timestamptz ELSE revisit_at END
       WHERE id=$1 RETURNING *`,
      [id,value.choice ?? null,value.rationale ?? null,value.alternatives ?? null,value.decidedAt ?? null,value.revisitAt !== undefined,value.revisitAt ?? null],
    );
    if (!result.rowCount) return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    return NextResponse.json({ data: result.rows[0] });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const id = z.string().uuid().parse((await params).id);
    const result = await pool.query('DELETE FROM decisions WHERE id=$1 RETURNING id',[id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
    return NextResponse.json({ data: { deleted: true,id } });
  } catch (error) { return jsonError(error); }
}
