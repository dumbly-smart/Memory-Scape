import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/db/pool';
import { jsonError } from '@/lib/api';
const schema=z.object({route:z.object({type:z.literal('LineString'),coordinates:z.array(z.tuple([z.number().min(-180).max(180),z.number().min(-90).max(90)])).min(2).max(1000)}),radiusMeters:z.number().min(1).max(50000).default(100)});
export async function POST(req:NextRequest){try{const v=schema.parse(await req.json());const r=await pool.query('SELECT * FROM spatial_memory_walk($1::jsonb,$2)',[JSON.stringify(v.route),v.radiusMeters]);return NextResponse.json({data:r.rows});}catch(e){return jsonError(e);}}
