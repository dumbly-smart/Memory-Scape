import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {jsonError} from '@/lib/api';
import {pool} from '@/lib/db/pool';

export const runtime='nodejs';
const pushHosts=['fcm.googleapis.com','push.services.mozilla.com','web.push.apple.com','notify.windows.com'];
const isSupportedEndpoint=(value:string)=>{try{const url=new URL(value);return url.protocol==='https:'&&pushHosts.some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`))}catch{return false}};
const subscriptionSchema=z.object({endpoint:z.string().url().refine(isSupportedEndpoint,'Endpoint must use a supported browser push service over HTTPS'),keys:z.object({p256dh:z.string().min(16).max(256),auth:z.string().min(8).max(256)}).strict()}).strict();
const unsubscribeSchema=z.object({endpoint:z.string().url().refine(isSupportedEndpoint,'Endpoint must use a supported browser push service over HTTPS')}).strict();

export async function POST(request:NextRequest){try{const value=subscriptionSchema.parse(await request.json());await pool.query('INSERT INTO push_subscriptions(endpoint,p256dh,auth) VALUES($1,$2,$3) ON CONFLICT(endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth',[value.endpoint,value.keys.p256dh,value.keys.auth]);return NextResponse.json({data:{subscribed:true}},{status:201})}catch(error){if(error instanceof z.ZodError)return NextResponse.json({error:error.issues[0]?.message??'Invalid push subscription'},{status:400});return jsonError(error)}}

export async function DELETE(request:NextRequest){try{const value=unsubscribeSchema.parse(await request.json());await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1',[value.endpoint]);return NextResponse.json({data:{subscribed:false}})}catch(error){if(error instanceof z.ZodError)return NextResponse.json({error:error.issues[0]?.message??'Invalid push subscription'},{status:400});return jsonError(error)}}
