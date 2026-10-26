import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

type Params = { params: Promise<{ id: string }> };
const schema = z.object({ title: z.string().trim().min(1).max(240).optional(), description: z.string().max(4000).optional(), dueAt: z.string().datetime().nullable().optional(), status: z.enum(['open','done','dismissed']).optional() }).refine(v => Object.keys(v).length > 0, { message: 'At least one field is required' });

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const followUpId = z.guid().parse((await params).id);
    const value = schema.parse(await request.json());
    const result = await pool.query(
      `UPDATE follow_ups SET title=coalesce($2,title),description=coalesce($3,description),
       due_at=CASE WHEN $4::boolean THEN $5::timestamptz ELSE due_at END,
       status=coalesce($6,status),completed_at=CASE WHEN coalesce($6,status)='done' THEN coalesce(completed_at,now()) ELSE NULL END
       WHERE id=$1 RETURNING *`,
      [followUpId,value.title ?? null,value.description ?? null,value.dueAt !== undefined,value.dueAt ?? null,value.status ?? null],
    );
    if (!result.rowCount) return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
    return NextResponse.json({ data: result.rows[0] });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const followUpId = z.guid().parse((await params).id);
    const result = await pool.query('DELETE FROM follow_ups WHERE id=$1 RETURNING id', [followUpId]);
    if (!result.rowCount) return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });
    return NextResponse.json({ data: { deleted: true, id: followUpId } });
  } catch (error) { return jsonError(error); }
}
