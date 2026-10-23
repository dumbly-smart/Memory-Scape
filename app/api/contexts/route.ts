import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

const create=z.object({type:z.enum(['Person','Place','Topic','Activity','Project','Emotion','Event','Custom']),label:z.string().trim().min(1).max(160),memoryId:z.string().uuid().optional()});
export async function GET() {
  try {
    const result=await pool.query(
      `SELECT c.*,count(mc.memory_id)::int memory_count,
       coalesce((SELECT json_agg(json_build_object('id',a.id,'alias',a.alias) ORDER BY a.normalized_alias) FROM context_aliases a WHERE a.context_id=c.id),'[]') aliases
       FROM contexts c LEFT JOIN memory_contexts mc ON mc.context_id=c.id GROUP BY c.id ORDER BY c.type,c.label`);
    return NextResponse.json({data:result.rows});
  } catch(error) { return jsonError(error); }
}
export async function POST(request:NextRequest) {
  try {
    const value=create.parse(await request.json());
    if(value.memoryId) {
      const result=await pool.query('SELECT link_memory_context($1,$2,$3) inserted',[value.memoryId,value.type,value.label]);
      return NextResponse.json({data:{inserted:result.rows[0].inserted}},{status:201});
    }
    const existing=await pool.query(
      `SELECT c.* FROM contexts c LEFT JOIN context_aliases a ON a.context_id=c.id
       WHERE c.type=$1 AND (lower(btrim(c.label))=lower(btrim($2)) OR a.normalized_alias=lower(btrim($2)))
       ORDER BY CASE WHEN lower(btrim(c.label))=lower(btrim($2)) THEN 0 ELSE 1 END,c.id LIMIT 1`,[value.type,value.label]);
    if(existing.rowCount) return NextResponse.json({data:existing.rows[0]});
    const inserted=await pool.query('INSERT INTO contexts(type,label) VALUES($1,$2) ON CONFLICT(type,label) DO UPDATE SET label=excluded.label RETURNING *',[value.type,value.label]);
    return NextResponse.json({data:inserted.rows[0]},{status:201});
  } catch(error) { return jsonError(error); }
}
