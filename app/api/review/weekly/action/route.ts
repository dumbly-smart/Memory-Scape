import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

const schema = z.object({ kind: z.enum(['memory','follow_up']), id: z.string().uuid(), action: z.enum(['keep','snooze','archive','dismiss']), snoozeDays: z.number().int().min(1).max(90).default(7) });

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const value = schema.parse(await request.json());
    await client.query('BEGIN');
    if (value.kind === 'memory') {
      const found = await client.query('SELECT id,is_sensitive,archived_at FROM memories WHERE id=$1 FOR UPDATE',[value.id]);
      if (!found.rowCount || found.rows[0].is_sensitive || found.rows[0].archived_at) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Memory is not available in weekly review' }, { status: 404 });
      }
      if (value.action === 'archive') await client.query('UPDATE memories SET archived_at=now() WHERE id=$1',[value.id]);
      if (value.action === 'keep') await client.query('UPDATE memories SET is_pinned=true WHERE id=$1',[value.id]);
      await client.query(
        `INSERT INTO review_actions(memory_id,action,snoozed_until) VALUES($1,$2,CASE WHEN $2='snooze' THEN now()+($3::text||' days')::interval ELSE NULL END)
         ON CONFLICT(memory_id) WHERE memory_id IS NOT NULL DO UPDATE SET action=excluded.action,actioned_at=now(),snoozed_until=excluded.snoozed_until`,
        [value.id,value.action,value.snoozeDays],
      );
    } else {
      const found = await client.query('SELECT id,status FROM follow_ups WHERE id=$1 FOR UPDATE',[value.id]);
      if (!found.rowCount || found.rows[0].status !== 'open') {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Follow-up is not available in weekly review' }, { status: 404 });
      }
      if (value.action === 'archive' || value.action === 'dismiss') await client.query("UPDATE follow_ups SET status='dismissed' WHERE id=$1",[value.id]);
      await client.query(
        `INSERT INTO review_actions(follow_up_id,action,snoozed_until) VALUES($1,$2,CASE WHEN $2='snooze' THEN now()+($3::text||' days')::interval ELSE NULL END)
         ON CONFLICT(follow_up_id) WHERE follow_up_id IS NOT NULL DO UPDATE SET action=excluded.action,actioned_at=now(),snoozed_until=excluded.snoozed_until`,
        [value.id,value.action,value.snoozeDays],
      );
    }
    await client.query('COMMIT');
    return NextResponse.json({ data: { kind: value.kind,id: value.id,action: value.action } });
  } catch (error) {
    await client.query('ROLLBACK');
    return jsonError(error);
  } finally { client.release(); }
}
