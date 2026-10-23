import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../lib/db/pool';
import { deliverPendingPushNotifications } from '../lib/push/service';

async function main(){
  const tag=randomUUID();
  const endpoint=`https://push.example.test/${tag}`;
  const calls:string[]=[];
  let memoryId:string|undefined;
  let privateMemoryId:string|undefined;
  try{
    const memory=await pool.query<{id:string}>(`INSERT INTO memories(title,content,occurred_at,strength,decay_rate,last_strength_at) VALUES($1,'push delivery fixture',now(),0.8,0,now()) RETURNING id`,[`Push delivery ${tag}`]);
    memoryId=memory.rows[0].id;
    const privateMemory=await pool.query<{id:string}>(`INSERT INTO memories(title,content,occurred_at,strength,decay_rate,last_strength_at,is_sensitive) VALUES($1,'private push delivery fixture',now(),0.8,0,now(),true) RETURNING id`,[`Private push delivery ${tag}`]);
    privateMemoryId=privateMemory.rows[0].id;
    await pool.query(`INSERT INTO follow_ups(title,due_at,status,memory_id) VALUES($1,now()-interval '1 minute','open',$2),($3,now()-interval '1 minute','open',$4)`,[`Due push ${tag}`,memoryId,`Private due push ${tag}`,privateMemoryId]);
    await pool.query('INSERT INTO push_subscriptions(endpoint,p256dh,auth) VALUES($1,$2,$3)',[endpoint,'B'.repeat(43),'a'.repeat(22)]);
    const send=async(_subscription:unknown,payload:string)=>{calls.push(payload);return {statusCode:201}};
    const first=await deliverPendingPushNotifications(send as never);
    assert(first.sent>=1,'expected at least one notification delivery');
    assert(calls.some(payload=>payload.includes(`Due push ${tag}`)),'expected the due follow-up in push payloads');
    assert(!calls.some(payload=>payload.includes(`Private due push ${tag}`)),'sensitive memories must not appear in push payloads');
    const repeatedCalls=calls.length;
    await deliverPendingPushNotifications(send as never);
    assert.equal(calls.length,repeatedCalls,'already delivered reminders must not send twice');
    console.log('Push delivery integration passed: due item sent, sensitive-linked item excluded, duplicate suppressed.');
  }finally{
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1',[endpoint]);
    if(memoryId) await pool.query('DELETE FROM memories WHERE id=$1',[memoryId]);
    if(privateMemoryId) await pool.query('DELETE FROM memories WHERE id=$1',[privateMemoryId]);
    await pool.end();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});
