import {readFile} from 'node:fs/promises';
import {describe,expect,it} from 'vitest';

type WorkerEvent={data?:{json:()=>unknown};notification?:{data?:{url?:string};close:()=>void};waitUntil:(promise:Promise<void>)=>void};
type Handler=(event:WorkerEvent)=>void;

describe('push service worker handlers',()=>{
  it('shows the encrypted push payload as a native notification',async()=>{
    const handlers=new Map<string,Handler>();
    const shown:Array<[string,NotificationOptions]>=[];
    const scope={location:{origin:'http://localhost:3000'},registration:{showNotification:async(title:string,options:NotificationOptions)=>{shown.push([title,options])}},addEventListener:(name:string,handler:Handler)=>handlers.set(name,handler),skipWaiting:()=>Promise.resolve(),clients:{claim:()=>Promise.resolve(),matchAll:async()=>[],openWindow:async()=>null},caches:{keys:async()=>[],open:async()=>({addAll:async()=>{},put:async()=>{}}),match:async()=>null}};
    const source=await readFile('public/service-worker.js','utf8');
    new Function('self',source)(scope);
    let finished:Promise<void>|undefined;
    handlers.get('push')?.({data:{json:()=>({title:'Follow-up',body:'Due soon',url:'/daily',tag:'reminder'})},waitUntil:(promise:Promise<void>)=>{finished=promise}});
    await finished;
    expect(shown).toEqual([['Follow-up',{body:'Due soon',tag:'reminder',data:{url:'/daily'}}]]);
  });

  it('opens only same-origin destinations when a push is clicked',async()=>{
    const handlers=new Map<string,Handler>();
    let opened='';
    const scope={location:{origin:'http://localhost:3000'},registration:{showNotification:async()=>{}},addEventListener:(name:string,handler:Handler)=>handlers.set(name,handler),skipWaiting:()=>Promise.resolve(),clients:{claim:()=>Promise.resolve(),matchAll:async()=>[],openWindow:async(url:string)=>{opened=url;return null}},caches:{keys:async()=>[],open:async()=>({addAll:async()=>{},put:async()=>{}}),match:async()=>null}};
    new Function('self',await readFile('public/service-worker.js','utf8'))(scope);
    let finished:Promise<void>|undefined;
    handlers.get('notificationclick')?.({notification:{data:{url:'https://attacker.example/steal'},close:()=>{}},waitUntil:(promise:Promise<void>)=>{finished=promise}});
    await finished;
    expect(opened).toBe('http://localhost:3000/daily');
  });
});
