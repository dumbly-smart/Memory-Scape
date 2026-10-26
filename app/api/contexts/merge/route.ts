import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';
const schema=z.object({sourceId:z.guid(),targetId:z.guid()}).refine(v=>v.sourceId!==v.targetId,{message:'Choose two different contexts'});

export async function POST(request:NextRequest) {
  const client=await pool.connect();
  try {
    const {sourceId,targetId}=schema.parse(await request.json());
    await client.query('BEGIN');
    const contexts=await client.query('SELECT id,type,label FROM contexts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[sourceId,targetId]]);
    if(contexts.rowCount!==2) { await client.query('ROLLBACK'); return NextResponse.json({error:'Source or target context not found'},{status:404}); }
    const source=contexts.rows.find(row=>row.id===sourceId)!;
    const target=contexts.rows.find(row=>row.id===targetId)!;
    if(source.type!==target.type) { await client.query('ROLLBACK'); return NextResponse.json({error:'Contexts can only be merged when their types match'},{status:400}); }
    const sourceAliasNames=await client.query('SELECT normalized_alias FROM context_aliases WHERE context_id=$1',[sourceId]);
    const incoming=[source.label.trim().toLocaleLowerCase('en-US'),...sourceAliasNames.rows.map(row=>row.normalized_alias as string)];
    const conflicts=await client.query(
      `SELECT c.label FROM contexts c WHERE c.type=$1 AND c.id NOT IN ($2,$4) AND lower(btrim(c.label))=ANY($3::text[])
       UNION SELECT c.label FROM context_aliases a JOIN contexts c ON c.id=a.context_id WHERE a.normalized_alias=ANY($3::text[]) AND c.id NOT IN ($2,$4) LIMIT 1`,
      [target.type,targetId,incoming,sourceId],
    );
    if(conflicts.rowCount) { await client.query('ROLLBACK'); return NextResponse.json({error:'A source alias conflicts with another context label or alias; remove that alias before merging'},{status:409}); }
    const memoryLinks=await client.query(
      `INSERT INTO memory_contexts(memory_id,context_id,created_at)
       SELECT memory_id,$2,created_at FROM memory_contexts WHERE context_id=$1
       ON CONFLICT(memory_id,context_id) DO NOTHING RETURNING memory_id`,[sourceId,targetId]);
    await client.query('DELETE FROM memory_contexts WHERE context_id=$1',[sourceId]);
    const followUps=await client.query('UPDATE follow_ups SET context_id=$2 WHERE context_id=$1 RETURNING id',[sourceId,targetId]);
    const decisions=await client.query('UPDATE decisions SET context_id=$2 WHERE context_id=$1 RETURNING id',[sourceId,targetId]);
    await client.query('DELETE FROM context_aliases WHERE context_id=$1 AND normalized_alias=$2',[sourceId,target.label.trim().toLocaleLowerCase('en-US')]);
    await client.query('UPDATE context_aliases SET context_id=$2 WHERE context_id=$1',[sourceId,targetId]);
    const sourceLabelAsAlias=source.label.trim().toLocaleLowerCase('en-US')!==target.label.trim().toLocaleLowerCase('en-US');
    if(sourceLabelAsAlias) await client.query('INSERT INTO context_aliases(context_id,alias) VALUES($1,$2) ON CONFLICT(normalized_alias) DO NOTHING',[targetId,source.label]);
    await client.query('DELETE FROM contexts WHERE id=$1',[sourceId]);
    await client.query('COMMIT');
    return NextResponse.json({data:{sourceId,targetId,memoryLinksMoved:memoryLinks.rowCount??0,followUpsMoved:followUps.rowCount??0,decisionsMoved:decisions.rowCount??0}});
  } catch(error) { await client.query('ROLLBACK'); return jsonError(error); }
  finally { client.release(); }
}
