import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';
import { sanitizeAttachmentFilename } from '@/lib/attachments';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const id = z.guid().parse((await params).id);
    const result = await pool.query('SELECT file_name,media_type,size_bytes,sha256,content FROM memory_attachments WHERE id=$1',[id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    const item = result.rows[0] as { file_name: string; media_type: string; size_bytes: number; sha256: string; content: Buffer };
    const encodedName = encodeURIComponent(sanitizeAttachmentFilename(item.file_name)).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    return new NextResponse(new Uint8Array(item.content), { headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(item.size_bytes),
      'Content-Disposition': `attachment; filename="attachment"; filename*=UTF-8''${encodedName}`,
      'Content-Digest': `sha-256=:${Buffer.from(item.sha256,'hex').toString('base64')}:`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const id = z.guid().parse((await params).id);
    const result = await pool.query('DELETE FROM memory_attachments WHERE id=$1 RETURNING id',[id]);
    if (!result.rowCount) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    return NextResponse.json({ data: { deleted: true,id } });
  } catch (error) { return jsonError(error); }
}
