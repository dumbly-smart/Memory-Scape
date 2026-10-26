import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

type Row = Record<string, unknown>;
const rows = z.array(z.record(z.string(), z.unknown())).max(20000);
const bundleSchema = z.object({
  format: z.literal('memoryscape-backup'), version: z.literal(1), exportedAt: z.string().datetime(), apply: z.boolean().optional(),
  memories: rows, contexts: rows, memoryContexts: rows, memoryEdges: rows, reinforcements: rows, followUps: rows, decisions: rows, attachments: rows, placeReminders: rows, reviewActions: rows,
});
const collectionTables = [
  ['memories', 'memories'], ['contexts', 'contexts'], ['memoryEdges', 'memory_edges'], ['reinforcements', 'memory_reinforcements'],
  ['followUps', 'follow_ups'], ['decisions', 'decisions'], ['attachments', 'memory_attachments'], ['placeReminders', 'place_reminders'], ['reviewActions', 'review_actions'],
] as const;
const id = (row: Row, key = 'id') => z.guid().parse(row[key]);
const str = (row: Row, key: string) => z.string().parse(row[key]);
const nullable = (row: Row, key: string) => row[key] === null || row[key] === undefined ? null : row[key];

export async function POST(request: NextRequest) {
  let input: z.infer<typeof bundleSchema>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > 15 * 1024 * 1024) return NextResponse.json({ error: 'Backup is larger than the 15 MiB import limit' }, { status: 413 });
    input = bundleSchema.parse(JSON.parse(raw));
  } catch (error) { return jsonError(error); }

  const counts = Object.fromEntries([...collectionTables.map(([key]) => [key, input[key].length] as const), ['memoryContexts', input.memoryContexts.length] as const]);
  let attachmentBytes = 0;
  try {
    for (const row of input.attachments) {
      const encoded = str(row, 'content_base64');
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error('An attachment contains invalid base64 data');
      const bytes = Buffer.from(encoded, 'base64');
      if (bytes.toString('base64') !== encoded) throw new Error('An attachment contains non-canonical base64 data');
      if (bytes.length > 10 * 1024 * 1024 || bytes.length !== Number(row.size_bytes) || createHash('sha256').update(bytes).digest('hex') !== str(row, 'sha256')) throw new Error('An attachment size or SHA-256 digest does not match its contents');
      attachmentBytes += bytes.length;
    }
    if (attachmentBytes > 10 * 1024 * 1024) throw new Error('Combined attachment data is larger than 10 MiB');
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid attachment data' }, { status: 400 }); }

  const client = await pool.connect();
  try {
    const collisions: string[] = [];
    for (const [key, table] of collectionTables) {
      const values = input[key].map(row => id(row));
      if (!values.length) continue;
      const existing = await client.query(`SELECT id FROM ${table} WHERE id=ANY($1::uuid[]) LIMIT 20`, [values]);
      if (existing.rowCount) collisions.push(`${table}: ${existing.rows.map(row => row.id).join(', ')}`);
    }
    if (input.contexts.length) {
      const labels = input.contexts.map(row => ({ type: str(row, 'type'), label: str(row, 'label') }));
      const existing = await client.query('SELECT type,label FROM contexts WHERE (type,label) IN (SELECT * FROM unnest($1::text[],$2::text[])) LIMIT 20', [labels.map(item => item.type), labels.map(item => item.label)]);
      if (existing.rowCount) collisions.push(`contexts already exist by type and label: ${existing.rows.map(row => `${row.type}:${row.label}`).join(', ')}`);
    }
    if (collisions.length) return NextResponse.json({ error: 'Import would overwrite or duplicate existing data', collisions }, { status: 409 });
    if (!input.apply) return NextResponse.json({ data: { applied: false, counts, attachmentBytes, collisions: [] }, message: 'Preview only. Send apply: true to import this bundle.' });

    await client.query('BEGIN');
    for (const row of input.memories) await client.query(`INSERT INTO memories(id,title,content,occurred_at,location,location_label,strength,decay_rate,last_strength_at,created_at,updated_at,source_url,source_title,is_pinned,is_sensitive,archived_at) VALUES($1,$2,$3,$4,CASE WHEN $5::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($6,$5),4326)::geography END,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`, [id(row),str(row,'title'),str(row,'content'),row.occurred_at,row.latitude,row.longitude,nullable(row,'location_label'),row.strength,row.decay_rate,row.last_strength_at,row.created_at,row.updated_at,nullable(row,'source_url'),nullable(row,'source_title'),row.is_pinned,row.is_sensitive,nullable(row,'archived_at')]);
    for (const row of input.contexts) await client.query('INSERT INTO contexts(id,type,label,created_at) VALUES($1,$2,$3,$4)', [id(row),str(row,'type'),str(row,'label'),row.created_at]);
    for (const row of input.memoryContexts) await client.query('INSERT INTO memory_contexts(memory_id,context_id,created_at) VALUES($1,$2,$3)', [id(row,'memory_id'),id(row,'context_id'),row.created_at]);
    for (const row of input.memoryEdges) await client.query('INSERT INTO memory_edges(id,src,dst,edge_type,valence,weight,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)', [id(row),id(row,'src'),id(row,'dst'),str(row,'edge_type'),row.valence,row.weight,row.created_at]);
    for (const row of input.reinforcements) await client.query('INSERT INTO memory_reinforcements(id,memory_id,reinforcement_type,strength_before,strength_after,reinforcement_amount,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)', [id(row),id(row,'memory_id'),str(row,'reinforcement_type'),row.strength_before,row.strength_after,row.reinforcement_amount,row.created_at]);
    for (const row of input.followUps) await client.query('INSERT INTO follow_ups(id,title,description,due_at,status,memory_id,context_id,created_at,updated_at,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id(row),str(row,'title'),str(row,'description'),nullable(row,'due_at'),str(row,'status'),nullable(row,'memory_id'),nullable(row,'context_id'),row.created_at,row.updated_at,nullable(row,'completed_at')]);
    for (const row of input.decisions) await client.query('INSERT INTO decisions(id,choice,rationale,alternatives,decided_at,revisit_at,memory_id,context_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id(row),str(row,'choice'),str(row,'rationale'),str(row,'alternatives'),row.decided_at,nullable(row,'revisit_at'),nullable(row,'memory_id'),nullable(row,'context_id'),row.created_at,row.updated_at]);
    for (const row of input.attachments) await client.query('INSERT INTO memory_attachments(id,memory_id,file_name,media_type,size_bytes,sha256,extracted_text,content,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id(row),id(row,'memory_id'),str(row,'file_name'),str(row,'media_type'),row.size_bytes,str(row,'sha256'),nullable(row,'extracted_text'),Buffer.from(str(row,'content_base64'),'base64'),row.created_at]);
    for (const row of input.placeReminders) await client.query(`INSERT INTO place_reminders(id,memory_id,title,location,location_label,radius_m,status,created_at,updated_at,completed_at) VALUES($1,$2,$3,ST_SetSRID(ST_MakePoint($4,$5),4326)::geography,$6,$7,$8,$9,$10,$11)`, [id(row),id(row,'memory_id'),str(row,'title'),row.longitude,row.latitude,nullable(row,'location_label'),row.radius_m,row.status,row.created_at,row.updated_at,nullable(row,'completed_at')]);
    for (const row of input.reviewActions) await client.query('INSERT INTO review_actions(id,memory_id,follow_up_id,action,actioned_at,snoozed_until) VALUES($1,$2,$3,$4,$5,$6)', [id(row),nullable(row,'memory_id'),nullable(row,'follow_up_id'),str(row,'action'),row.actioned_at,nullable(row,'snoozed_until')]);
    await client.query('COMMIT');
    return NextResponse.json({ data: { applied: true, counts, attachmentBytes } }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    return jsonError(error);
  } finally { client.release(); }
}
