import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/db/pool';
import { jsonError } from '@/lib/api';
import { deriveCaptureTitle, safeCaptureUrl } from '@/lib/capture';

const schema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(20000).default(''),
  occurredAt: z.string().datetime().optional(),
  sourceUrl: z.string().max(4096).optional(),
  sourceTitle: z.string().max(500).optional(),
  contextId: z.string().uuid().optional(),
  isPinned: z.boolean().default(false),
  isSensitive: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const input = schema.parse(await request.json());
    const sourceUrl = safeCaptureUrl(input.sourceUrl);
    if (input.sourceUrl?.trim() && !sourceUrl) return NextResponse.json({ error: 'Only HTTP and HTTPS source URLs are allowed' }, { status: 400 });
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO memories(title,content,occurred_at,source_url,source_title,is_pinned,is_sensitive,last_strength_at)
       VALUES($1,$2,coalesce($3::timestamptz,now()),$4,$5,$6,$7,now()) RETURNING id,title,occurred_at,source_url,is_pinned,is_sensitive`,
      [deriveCaptureTitle(input.title, input.content), input.content, input.occurredAt ?? null, sourceUrl, input.sourceTitle?.trim() || null, input.isPinned, input.isSensitive],
    );
    if (input.contextId) {
      const linked = await client.query('SELECT link_memory_context($1,c.type,c.label) AS inserted FROM contexts c WHERE c.id=$2', [result.rows[0].id, input.contextId]);
      if (!linked.rowCount) throw new Error('Context not found');
    }
    await client.query('COMMIT');
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    return jsonError(error);
  } finally {
    client.release();
  }
}
