import {NextResponse} from 'next/server';
import {jsonError} from '@/lib/api';
import {getVapidConfig} from '@/lib/push/service';

export const runtime='nodejs';
export async function GET(){try{const config=await getVapidConfig();return NextResponse.json({data:{publicKey:config.public_key}})}catch(error){return jsonError(error)}}
