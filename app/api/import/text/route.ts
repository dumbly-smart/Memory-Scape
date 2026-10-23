import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';
import { parseTextImport, type ImportedMemory } from '@/lib/text-import';

export const runtime = 'nodejs';
const requestSchema = z.object({
  action: z.enum(['preview','apply']),
  files: z.array(z.object({ name:z.string().min(1).max(255), content:z.string() })).min(1).max(100),
});
const maxBytes = 15 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const input = requestSchema.parse(await request.json());
    const totalBytes = input.files.reduce((sum,file)=>sum+Buffer.byteLength(file.content,'utf8'),0);
    if (totalBytes > maxBytes) return NextResponse.json({ error:'Import is limited to 15 MiB total' },{status:413});
    let parsedItems:ImportedMemory[];
    try { parsedItems = input.files.flatMap(file=>parseTextImport(file.name,file.content)); }
    catch(error) { return NextResponse.json({error:error instanceof Error?error.message:'Invalid import file'},{status:400}); }
    if (parsedItems.length > 1000) return NextResponse.json({ error:'An import batch is limited to 1,000 entries' },{status:413});
    const items=[...new Map(parsedItems.map(item=>[item.captureKey,item])).values()];
    const batchDuplicates=parsedItems.length-items.length;
    const keys = items.map(item=>item.captureKey);
    const existing = await pool.query('SELECT capture_key FROM memories WHERE capture_key=ANY($1::uuid[])',[keys]);
    const existingKeys = new Set(existing.rows.map(row=>row.capture_key as string));
    const databaseDuplicates = items.filter(item=>existingKeys.has(item.captureKey)).length;
    const duplicates = batchDuplicates + databaseDuplicates;
    if (input.action === 'preview') {
      return NextResponse.json({ data:{ items:items.map(({captureKey,...item})=>item), total:parsedItems.length, duplicates, newEntries:items.length-databaseDuplicates, totalBytes } });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let inserted = 0;
      for (const item of items) {
        const result = await client.query(
          `INSERT INTO memories(capture_key,title,content,occurred_at,source_url,source_title)
           VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(capture_key) WHERE capture_key IS NOT NULL DO NOTHING RETURNING id`,
          [item.captureKey,item.title,item.content,item.occurredAt,item.sourceUrl??null,item.sourceTitle??null],
        );
        inserted += result.rowCount ?? 0;
      }
      await client.query('COMMIT');
      return NextResponse.json({ data:{ inserted, skipped:parsedItems.length-inserted, total:parsedItems.length } });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } catch (error) { return jsonError(error); }
}
