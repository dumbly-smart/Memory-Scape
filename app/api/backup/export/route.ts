import { NextResponse } from 'next/server';
import { pool } from '@/lib/db/pool';
import { jsonError } from '@/lib/api';

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const memories = await client.query(`SELECT id,title,content,occurred_at,ST_Y(location::geometry) AS latitude,ST_X(location::geometry) AS longitude,location_label,strength,decay_rate,last_strength_at,created_at,updated_at,source_url,source_title,is_pinned,is_sensitive,archived_at FROM memories ORDER BY id`);
      const contexts = await client.query('SELECT * FROM contexts ORDER BY id');
      const memoryContexts = await client.query('SELECT * FROM memory_contexts ORDER BY memory_id,context_id');
      const memoryEdges = await client.query('SELECT * FROM memory_edges ORDER BY id');
      const reinforcements = await client.query('SELECT * FROM memory_reinforcements ORDER BY id');
      const followUps = await client.query('SELECT * FROM follow_ups ORDER BY id');
      const decisions = await client.query('SELECT * FROM decisions ORDER BY id');
      const attachments = await client.query(`SELECT id,memory_id,file_name,media_type,size_bytes,sha256,extracted_text,encode(content,'base64') AS content_base64,created_at FROM memory_attachments ORDER BY id`);
      const placeReminders = await client.query(`SELECT id,memory_id,title,ST_Y(location::geometry) AS latitude,ST_X(location::geometry) AS longitude,location_label,radius_m,status,created_at,updated_at,completed_at FROM place_reminders ORDER BY id`);
      const reviewActions = await client.query('SELECT * FROM review_actions ORDER BY id');
      await client.query('COMMIT');
      const bundle = { format: 'memoryscape-backup', version: 1, exportedAt: new Date().toISOString(), memories: memories.rows, contexts: contexts.rows, memoryContexts: memoryContexts.rows, memoryEdges: memoryEdges.rows, reinforcements: reinforcements.rows, followUps: followUps.rows, decisions: decisions.rows, attachments: attachments.rows, placeReminders: placeReminders.rows, reviewActions: reviewActions.rows };
      return new NextResponse(JSON.stringify(bundle), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="memoryscape-backup-${new Date().toISOString().slice(0,10)}.json"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } catch (error) { return jsonError(error); }
}
