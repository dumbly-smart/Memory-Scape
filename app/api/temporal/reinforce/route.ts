import{NextRequest,NextResponse}from'next/server';import{z}from'zod';import{pool}from'@/lib/db/pool';import{jsonError}from'@/lib/api';
const schema=z.object({memoryId:z.string().uuid(),factor:z.number().min(0).max(1).default(0.2),type:z.string().trim().min(1).max(80).default('review')});
export async function POST(req:NextRequest){try{const v=schema.parse(await req.json());const r=await pool.query('SELECT * FROM reinforce_memory($1,$2,$3)',[v.memoryId,v.factor,v.type]);return NextResponse.json({data:r.rows[0]});}catch(e){return jsonError(e);}}
