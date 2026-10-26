import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';
import { extractSearchableText, safeMediaType, sanitizeAttachmentFilename } from '@/lib/attachments';

type Params = { params: Promise<{ id: string }> };
const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const memoryId = z.guid().parse((await params).id);
    const result = await pool.query('SELECT id,memory_id,file_name,media_type,size_bytes,sha256,extracted_text IS NOT NULL AS searchable,created_at FROM memory_attachments WHERE memory_id=$1 ORDER BY created_at DESC,id',[memoryId]);
    return NextResponse.json({ data: result.rows });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const memoryId = z.guid().parse((await params).id);
    const length = Number(request.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_FILE_BYTES + 64 * 1024) return NextResponse.json({ error: 'Attachment exceeds the 10 MiB limit' }, { status: 413 });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'A file is required' }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Attachment exceeds the 10 MiB limit' }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileName = sanitizeAttachmentFilename(file.name);
    const mediaType = safeMediaType(file.type);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const extractedText = await extractSearchableText(bytes, mediaType);
    const result = await pool.query(
      `INSERT INTO memory_attachments(memory_id,file_name,media_type,size_bytes,sha256,extracted_text,content)
       SELECT id,$2,$3,$4,$5,$6,$7 FROM memories WHERE id=$1 RETURNING id,memory_id,file_name,media_type,size_bytes,sha256,extracted_text IS NOT NULL AS searchable,created_at`,
      [memoryId,fileName,mediaType,bytes.byteLength,sha256,extractedText,Buffer.from(bytes)],
    );
    if (!result.rowCount) return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
