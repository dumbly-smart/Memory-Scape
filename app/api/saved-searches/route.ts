import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/api';
import { pool } from '@/lib/db/pool';

const filtersSchema=z.object({
  q:z.string().max(200).optional(),
  from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const date=new Date(`${value}T00:00:00.000Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;},'Invalid date').optional(),
  to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const date=new Date(`${value}T00:00:00.000Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;},'Invalid date').optional(),
  contextId:z.string().uuid().optional(),
  minStrength:z.enum(['0.25','0.5','0.75']).optional(),
  hasLocation:z.enum(['true','false']).optional(),
  sort:z.enum(['occurred_desc','occurred_asc','strength_desc','strength_asc']).optional(),
}).strict().refine(value=>!value.from||!value.to||value.from<=value.to,{message:'From date must be on or before to date'});
const create=z.object({name:z.string().trim().min(1).max(80),filters:filtersSchema}).strict();
export { filtersSchema };

export async function GET() {
  try {const result=await pool.query('SELECT id,name,filters,created_at,updated_at FROM saved_searches ORDER BY lower(name),id');return NextResponse.json({data:result.rows});}
  catch(error){return jsonError(error);}
}
export async function POST(request:NextRequest) {
  try {const value=create.parse(await request.json());const result=await pool.query('INSERT INTO saved_searches(name,filters) VALUES($1,$2::jsonb) RETURNING id,name,filters,created_at,updated_at',[value.name,JSON.stringify(value.filters)]);return NextResponse.json({data:result.rows[0]},{status:201});}
  catch(error){return jsonError(error);}
}
