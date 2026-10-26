import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

type Params={params:Promise<{id:string}>};
const idSchema=z.guid();
const create=z.object({alias:z.string().trim().min(1).max(160)});

export async function GET(_request:NextRequest,{params}:Params) {
  try {
    const contextId=idSchema.parse((await params).id);
    const result=await pool.query('SELECT id,context_id,alias,normalized_alias,created_at FROM context_aliases WHERE context_id=$1 ORDER BY normalized_alias',[contextId]);
    return NextResponse.json({data:result.rows});
  } catch(error) { return jsonError(error); }
}

export async function POST(request:NextRequest,{params}:Params) {
  try {
    const contextId=idSchema.parse((await params).id);
    const {alias}=create.parse(await request.json());
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      const context=await client.query('SELECT id,type,label FROM contexts WHERE id=$1 FOR UPDATE',[contextId]);
      if(!context.rowCount) { await client.query('ROLLBACK'); return NextResponse.json({error:'Context not found'},{status:404}); }
      const normalized=alias.trim().toLocaleLowerCase('en-US');
      if(context.rows[0].label.trim().toLocaleLowerCase('en-US')===normalized) { await client.query('ROLLBACK'); return NextResponse.json({error:'Alias already matches this context label'},{status:409}); }
      const canonical=await client.query('SELECT 1 FROM contexts WHERE type=$1 AND lower(btrim(label))=$2 AND id<>$3',[context.rows[0].type,normalized,contextId]);
      if(canonical.rowCount) { await client.query('ROLLBACK'); return NextResponse.json({error:'Alias matches another context label of the same type'},{status:409}); }
      const result=await client.query('INSERT INTO context_aliases(context_id,alias) VALUES($1,$2) RETURNING id,context_id,alias,normalized_alias,created_at',[contextId,alias.trim()]);
      await client.query('COMMIT');
      return NextResponse.json({data:result.rows[0]},{status:201});
    } catch(error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } catch(error) { return jsonError(error); }
}
