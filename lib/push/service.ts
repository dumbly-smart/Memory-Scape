import webpush from 'web-push';
import { pool } from '@/lib/db/pool';

type VapidConfig={public_key:string;private_key:string;subject:string};
type SubscriptionRow={id:string;endpoint:string;p256dh:string;auth:string};
type DueItem={source_type:'follow-up'|'decision';source_id:string;title:string;due_at:string};
type PushSubscriptionShape={endpoint:string;keys:{p256dh:string;auth:string}};
type SendPush=(subscription:PushSubscriptionShape,payload:string,options:{TTL:number;urgency:'normal';vapidDetails:{subject:string;publicKey:string;privateKey:string}})=>Promise<unknown>;

export async function getVapidConfig():Promise<VapidConfig> {
  const present=await pool.query<VapidConfig>('SELECT public_key,private_key,subject FROM push_vapid_config WHERE id=1');
  if(present.rows[0]) return present.rows[0];
  const generated=webpush.generateVAPIDKeys();
  await pool.query('INSERT INTO push_vapid_config(id,public_key,private_key) VALUES(1,$1,$2) ON CONFLICT(id) DO NOTHING',[generated.publicKey,generated.privateKey]);
  const saved=await pool.query<VapidConfig>('SELECT public_key,private_key,subject FROM push_vapid_config WHERE id=1');
  if(!saved.rows[0]) throw new Error('Push notification keys could not be initialized');
  return saved.rows[0];
}

export async function deliverPendingPushNotifications(send:SendPush=webpush.sendNotification as SendPush):Promise<{sent:number;failed:number}> {
  const subscriptions=(await pool.query<SubscriptionRow>('SELECT id,endpoint,p256dh,auth FROM push_subscriptions ORDER BY created_at')).rows;
  if(!subscriptions.length) return {sent:0,failed:0};
  const config=await getVapidConfig();
  const pending=(await pool.query<DueItem>(`
    SELECT 'follow-up'::text AS source_type,f.id AS source_id,f.title,f.due_at
    FROM follow_ups f LEFT JOIN memories m ON m.id=f.memory_id
    WHERE f.status='open' AND f.due_at IS NOT NULL AND f.due_at<=now()+interval '1 day'
      AND (f.memory_id IS NULL OR (NOT m.is_sensitive AND m.archived_at IS NULL))
    UNION ALL
    SELECT 'decision'::text,d.id AS source_id,d.choice AS title,d.revisit_at AS due_at
    FROM decisions d LEFT JOIN memories m ON m.id=d.memory_id
    WHERE d.revisit_at IS NOT NULL AND d.revisit_at<=now()+interval '1 day'
      AND (d.memory_id IS NULL OR (NOT m.is_sensitive AND m.archived_at IS NULL))
    ORDER BY due_at ASC LIMIT 200`)).rows;
  let sent=0,failed=0;
  const vapidDetails={subject:config.subject,publicKey:config.public_key,privateKey:config.private_key};
  for(const subscription of subscriptions) for(const item of pending) {
    const claimed=await pool.query('INSERT INTO push_delivery_receipts(subscription_id,source_type,source_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING subscription_id',[subscription.id,item.source_type,item.source_id]);
    if(!claimed.rowCount) continue;
    const body=JSON.stringify({title:item.title,body:item.source_type==='follow-up'?(new Date(item.due_at).getTime()<Date.now()?'Overdue follow-up':'Follow-up due within a day'):'Decision ready to revisit',url:'/daily',tag:`${item.source_type}:${item.source_id}`});
    try {
      await send({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},body,{TTL:3600,urgency:'normal',vapidDetails});
      await pool.query('UPDATE push_subscriptions SET last_success_at=now() WHERE id=$1',[subscription.id]);
      sent++;
    } catch(error) {
      const status=(error as {statusCode?:number})?.statusCode;
      if(status===404||status===410) await pool.query('DELETE FROM push_subscriptions WHERE id=$1',[subscription.id]);
      else await pool.query('DELETE FROM push_delivery_receipts WHERE subscription_id=$1 AND source_type=$2 AND source_id=$3',[subscription.id,item.source_type,item.source_id]);
      failed++;
    }
  }
  return {sent,failed};
}

const timerKey='__memoryscapePushTimer';
type TimerRoot=typeof globalThis&{[timerKey]?:ReturnType<typeof setInterval>};
export function startPushScheduler():void {
  const root=globalThis as TimerRoot;
  if(root[timerKey]) return;
  console.info('MemoryScape background push scheduler started (60-second interval)');
  const timer=setInterval(()=>{void deliverPendingPushNotifications().then(result=>{if(result.sent||result.failed)console.info('MemoryScape push delivery',result)}).catch(error=>console.error('MemoryScape push delivery failed',error instanceof Error?error.message:'unknown error'))},60_000);
  timer.unref?.();
  root[timerKey]=timer;
}
