import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';
type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const id = z.guid().parse((await params).id);
    const result = await pool.query('DELETE FROM place_reminders WHERE id=$1 RETURNING id',[id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Place reminder not found' }, { status: 404 });
    return NextResponse.json({ data: { deleted: true,id } });
  } catch (error) { return jsonError(error); }
}
