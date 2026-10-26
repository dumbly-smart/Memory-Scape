import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';
type Params={params:Promise<{id:string;aliasId:string}>};
export async function DELETE(_request:NextRequest,{params}:Params) {
  try {
    const value=z.object({id:z.guid(),aliasId:z.guid()}).parse(await params);
    const result=await pool.query('DELETE FROM context_aliases WHERE context_id=$1 AND id=$2 RETURNING id',[value.id,value.aliasId]);
    if(!result.rowCount) return NextResponse.json({error:'Context alias not found'},{status:404});
    return NextResponse.json({data:{deleted:true,id:value.aliasId}});
  } catch(error) { return jsonError(error); }
}
