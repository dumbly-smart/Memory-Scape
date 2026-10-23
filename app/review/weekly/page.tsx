'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type Item = { kind: 'memory'|'follow_up'; id: string; title: string; description: string; occurred_at: string; due_at: string | null; strength: number | null; review_priority: number; reasons: string[]; memory_id: string | null; context_label: string | null };

export default function WeeklyReviewPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/review/weekly');
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? 'Could not load weekly review');
    setItems(value.data as Item[]);
  }, []);
  useEffect(() => { load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load weekly review')).finally(() => setLoading(false)); }, [load]);

  async function act(item: Item, action: 'keep'|'snooze'|'archive'|'dismiss') {
    setError(''); setStatus('');
    const response = await fetch('/api/review/weekly/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: item.kind, id: item.id, action, snoozeDays: 7 }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? 'Could not save review action'); return; }
    setItems(current => current.filter(candidate => candidate.id !== item.id || candidate.kind !== item.kind));
    setStatus(`${item.title}: ${action === 'keep' ? 'kept and pinned' : action === 'snooze' ? 'snoozed for seven days' : action === 'archive' ? 'archived' : 'dismissed'}.`);
  }

  return <>
    <div className="page-head"><div><div className="eyebrow">WEEKLY RESET</div><h1>Weekly review</h1><p>Review what is due, recent, pinned, or fading. You choose what should return.</p></div><Link className="button secondary" href="/review">Fading memories</Link></div>
    {error && <div role="alert" className="error">{error}</div>}{status && <div role="status" className="success">{status}</div>}
    {loading ? <div className="empty" role="status">Loading weekly review…</div> : items.length ? <div className="dashboard-grid">
      {items.map(item => <article className="panel" key={`${item.kind}:${item.id}`}>
        <div className="panel-title"><span className="eyebrow">{item.kind === 'memory' ? 'MEMORY' : 'FOLLOW-UP'}</span><span className="muted">Priority {Number(item.review_priority).toFixed(2)}</span></div>
        <h2 style={{ margin: '0 0 8px', fontFamily: 'Manrope' }}>{item.title}</h2>
        <p>{item.description || 'No additional details.'}</p>
        <div className="muted">{item.reasons.join(' · ')}{item.due_at ? ` · Due ${new Date(item.due_at).toLocaleString()}` : ` · ${new Date(item.occurred_at).toLocaleDateString()}`}{item.strength !== null ? ` · Strength ${Math.round(item.strength * 100)}%` : ''}{item.context_label ? ` · ${item.context_label}` : ''}</div>
        {item.memory_id && <p><Link href={`/memories?memory=${item.memory_id}`}>Open linked memory</Link></p>}
        <div className="toolbar" style={{ flexWrap: 'wrap', marginTop: 14, marginBottom: 0 }}>
          <button className="button secondary" onClick={() => act(item,'keep')}>Keep</button>
          <button className="button secondary" onClick={() => act(item,'snooze')}>Snooze</button>
          <button className="button secondary" onClick={() => act(item,'archive')}>Archive</button>
          <button className="button ghost" onClick={() => act(item,'dismiss')}>Dismiss</button>
        </div>
      </article>)}
    </div> : <div className="panel empty">You are caught up. New recent memories and due actions will appear here as they become relevant.</div>}
  </>;
}
