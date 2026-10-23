'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Brief = {
  dueFollowUps: { id: string; title: string; description: string; due_at: string; memory_id: string | null; memory_title: string | null; context_id: string | null; context_label: string | null }[];
  decisionsToRevisit: { id: string; choice: string; rationale: string; revisit_at: string; memory_id: string | null; memory_title: string | null; context_id: string | null; context_label: string | null }[];
  fadingMemories: { memory_id: string; title: string; strength: number; relevant_contexts: string[]; review_priority: number }[];
  fadingRefreshedAt: string | null;
};

const optInKey = 'memoryscape.dailyBriefNotifications';
const notifiedKey = 'memoryscape.dailyBriefNotifiedIds';

function applicationServerKey(value:string):Uint8Array {
  const padding='='.repeat((4-value.length%4)%4);
  const decoded=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(decoded,character=>character.charCodeAt(0));
}

function sendDueNotifications(brief: Brief) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || localStorage.getItem(optInKey) !== 'true') return;
  const sent = new Set<string>(JSON.parse(localStorage.getItem(notifiedKey) ?? '[]') as string[]);
  const now = new Date();
  const today = [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  const reminders = [
    ...brief.dueFollowUps.map(item => ({ id: `followup:${item.id}`, title: item.title, body: item.due_at < new Date().toISOString() ? 'Overdue follow-up' : 'Due within a day' })),
    ...brief.decisionsToRevisit.map(item => ({ id: `decision:${item.id}`, title: item.choice, body: 'Decision ready to revisit' })),
  ];
  for (const reminder of reminders) {
    const key = `${today}:${reminder.id}`;
    if (sent.has(key)) continue;
    new Notification(reminder.title, { body: reminder.body, tag: key });
    sent.add(key);
  }
  localStorage.setItem(notifiedKey, JSON.stringify([...sent].slice(-500)));
}

export default function DailyBriefPage() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [backgroundPushEnabled,setBackgroundPushEnabled]=useState(false);
  const load = useCallback(async (notify = false) => {
    const response = await fetch('/api/daily', { cache: 'no-store' });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? 'Could not load daily brief');
    setBrief(value.data as Brief);
    if (notify) sendDueNotifications(value.data as Brief);
  }, []);

  useEffect(() => {
    setNotificationsEnabled(localStorage.getItem(optInKey) === 'true' && typeof Notification !== 'undefined' && Notification.permission === 'granted');
    if('serviceWorker' in navigator&&'PushManager' in window) void navigator.serviceWorker.ready.then(registration=>registration.pushManager.getSubscription()).then(subscription=>setBackgroundPushEnabled(Boolean(subscription))).catch(()=>setBackgroundPushEnabled(false));
    load(true).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load daily brief')).finally(() => setLoading(false));
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') load(true).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not refresh daily brief')); }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function enableNotifications() {
    if (typeof Notification === 'undefined') { setNotificationMessage('This browser does not support notifications.'); return; }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { localStorage.removeItem(optInKey); setNotificationsEnabled(false); setNotificationMessage('Notifications were not enabled. The daily brief still works here.'); return; }
    localStorage.setItem(optInKey, 'true');
    setNotificationsEnabled(true);
    setNotificationMessage('Enabled while MemoryScape is open in this browser. No background push is used.');
    if (brief) sendDueNotifications(brief);
  }

  function disableNotifications() {
    localStorage.removeItem(optInKey);
    setNotificationsEnabled(false);
    setNotificationMessage('Daily notifications disabled.');
  }

  async function enableBackgroundPush(){
    setNotificationMessage('');
    if(!('serviceWorker' in navigator)||!('PushManager' in window)||typeof Notification==='undefined'){setNotificationMessage('Background push is not supported by this browser. The daily brief remains available.');return}
    try{
      if(Notification.permission!=='granted'&&await Notification.requestPermission()!=='granted')throw new Error('Notification permission was not granted.');
      const response=await fetch('/api/push/public-key');
      const keyBody=await response.json();
      if(!response.ok)throw new Error(keyBody.error??'Push notifications could not be configured.');
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationServerKey(keyBody.data.publicKey) as BufferSource});
      const serialized=subscription.toJSON();
      const saved=await fetch('/api/push/subscriptions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint,keys:serialized.keys})});
      const result=await saved.json();
      if(!saved.ok)throw new Error(result.error??'Push subscription could not be saved.');
      setBackgroundPushEnabled(true);
      setNotificationMessage('Background reminders enabled. Open follow-ups and decisions due within a day may arrive while MemoryScape is closed.');
    }catch(cause){setNotificationMessage(cause instanceof Error?cause.message:'Background push could not be enabled.')}
  }

  async function disableBackgroundPush(){
    try{
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription();
      if(subscription){
        const response=await fetch('/api/push/subscriptions',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})});
        if(!response.ok)throw new Error('Could not remove the server push subscription.');
        await subscription.unsubscribe();
      }
      setBackgroundPushEnabled(false);
      setNotificationMessage('Background reminders disabled.');
    }catch(cause){setNotificationMessage(cause instanceof Error?cause.message:'Background push could not be disabled.')}
  }

  return <>
    <div className="page-head"><div><div className="eyebrow">DAILY BRIEF</div><h1>Today, in context</h1><p>Due follow-ups, decisions to revisit, and memories that could use a review.</p></div><div className="toolbar" style={{ margin: 0, flexWrap:'wrap' }}><button className="button secondary" onClick={notificationsEnabled ? disableNotifications : enableNotifications}>{notificationsEnabled ? 'Disable in-page notifications' : 'Enable in-page notifications'}</button><button className="button" onClick={backgroundPushEnabled?disableBackgroundPush:enableBackgroundPush}>{backgroundPushEnabled?'Disable background reminders':'Enable background reminders'}</button></div></div>
    <p className="muted">In-page alerts are checked every five minutes while this page is open. Background reminders use opt-in Web Push; the browser’s push service relays the encrypted notification payload.</p>
    {notificationMessage && <p className="success" role="status">{notificationMessage}</p>}
    {error && <div className="error" role="alert">{error}</div>}
    {loading ? <div className="panel empty" role="status">Preparing today’s brief…</div> : brief && <div className="dashboard-grid">
      <section className="panel"><div className="panel-title"><h2>Due follow-ups</h2><span className="muted">{brief.dueFollowUps.length}</span></div>{brief.dueFollowUps.length ? brief.dueFollowUps.map(item => <article className="algorithm-note" key={item.id}><strong>{item.title}</strong><p>{item.description || 'No additional details.'}</p><div className="muted">{new Date(item.due_at).toLocaleString()} · {item.memory_title ?? item.context_label ?? 'Linked item'}</div>{item.memory_id && <Link href={`/memories?memory=${item.memory_id}`}>Open memory</Link>}{item.context_id && !item.memory_id && <Link href={`/contexts/${item.context_id}`}>Open context</Link>}</article>) : <p className="empty">Nothing due in the next 24 hours.</p>}</section>
      <section className="panel"><div className="panel-title"><h2>Decisions to revisit</h2><span className="muted">{brief.decisionsToRevisit.length}</span></div>{brief.decisionsToRevisit.length ? brief.decisionsToRevisit.map(item => <article className="algorithm-note" key={item.id}><strong>{item.choice}</strong><p>{item.rationale}</p><div className="muted">Revisit {new Date(item.revisit_at).toLocaleString()} · {item.memory_title ?? item.context_label ?? 'Linked item'}</div>{item.memory_id && <Link href={`/memories?memory=${item.memory_id}`}>Open memory</Link>}{item.context_id && !item.memory_id && <Link href={`/contexts/${item.context_id}`}>Open context</Link>}</article>) : <p className="empty">No decisions are due for a revisit.</p>}</section>
      <section className="panel"><div className="panel-title"><h2>Memories to review</h2><Link href="/review">Open review queue</Link></div>{brief.fadingRefreshedAt && <p className="muted">Fading snapshot refreshed {new Date(brief.fadingRefreshedAt).toLocaleString()}.</p>}{brief.fadingMemories.length ? brief.fadingMemories.map(item => <div className="toolbar" key={item.memory_id} style={{ justifyContent: 'space-between' }}><Link href={`/memories?memory=${item.memory_id}`}>{item.title}</Link><span className="muted">{Math.round(Number(item.strength) * 100)}% · priority {Number(item.review_priority).toFixed(2)}</span></div>) : <p className="empty">No fading memories in the latest snapshot.</p>}</section>
    </div>}
  </>;
}
