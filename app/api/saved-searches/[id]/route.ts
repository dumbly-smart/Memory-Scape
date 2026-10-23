import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';
import { filtersSchema } from '@/app/api/saved-searches/route';
type Params={params:Promise<{id:string}>};
const patch=z.object({name:z.string().trim().min(1).max(80).optional(),filters:filtersSchema.optional()}).strict().refine(value=>Object.keys(value).length>0,{message:'Provide a name or filter update'});
const idSchema=z.string().uuid();
export async function GET(_request:NextRequest,{params}:Params) {
  try {const id=idSchema.parse((await params).id);const result=await pool.query('SELECT id,name,filters,created_at,updated_at FROM saved_searches WHERE id=$1',[id]);if(!result.rowCount)return NextResponse.json({error:'Saved search not found'},{status:404});return NextResponse.json({data:result.rows[0]});}
  catch(error){return jsonError(error);}
}
export async function PATCH(request:NextRequest,{params}:Params) {
  try {const id=idSchema.parse((await params).id);const value=patch.parse(await request.json());const result=await pool.query('UPDATE saved_searches SET name=coalesce($2,name),filters=coalesce($3::jsonb,filters) WHERE id=$1 RETURNING id,name,filters,created_at,updated_at',[id,value.name??null,value.filters?JSON.stringify(value.filters):null]);if(!result.rowCount)return NextResponse.json({error:'Saved search not found'},{status:404});return NextResponse.json({data:result.rows[0]});}
  catch(error){return jsonError(error);}
}
export async function DELETE(_request:NextRequest,{params}:Params) {
  try {const id=idSchema.parse((await params).id);const result=await pool.query('DELETE FROM saved_searches WHERE id=$1 RETURNING id',[id]);if(!result.rowCount)return NextResponse.json({error:'Saved search not found'},{status:404});return NextResponse.json({data:{deleted:true,id}});}
  catch(error){return jsonError(error);}
}
