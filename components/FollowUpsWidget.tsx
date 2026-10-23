'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type FollowUp = { id: string; title: string; description: string; due_at: string | null; status: 'open'|'done'|'dismissed'; completed_at: string | null };
type Props = { memoryId?: string; contextId?: string };

export function FollowUpsWidget({ memoryId, contextId }: Props) {
  const [items, setItems] = useState<FollowUp[]>([]);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ownerKey = memoryId ?? contextId ?? '';
  const filterName = memoryId ? 'memoryId' : 'contextId';

  const load = useCallback(async () => {
    if (!ownerKey) return;
    const response = await fetch(`/api/follow-ups?${filterName}=${ownerKey}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Could not load follow-ups');
    setItems(result.data as FollowUp[]);
  }, [filterName, ownerKey]);

  useEffect(() => { load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load follow-ups')); }, [load]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/follow-ups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined, ...(memoryId ? { memoryId } : { contextId }) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not add follow-up');
      setTitle(''); setDueAt(''); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add follow-up'); }
    finally { setBusy(false); }
  }

  async function setStatus(item: FollowUp, status: FollowUp['status']) {
    const response = await fetch(`/api/follow-ups/${item.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? 'Could not update follow-up'); return; }
    await load();
  }

  return <section className="panel" aria-label="Follow-ups">
    <div className="panel-title"><h2>Next actions</h2><span className="muted">Linked to this {memoryId ? 'memory' : 'context'}</span></div>
    <form onSubmit={add} className="toolbar" style={{ flexWrap: 'wrap' }}>
      <input className="input" aria-label="Follow-up title" value={title} onChange={event => setTitle(event.target.value)} maxLength={240} required placeholder="What needs doing?" />
      <label className="muted">Due <input className="input" aria-label="Follow-up due date" type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></label>
      <button className="button secondary" disabled={busy || !title.trim()}>{busy ? 'Adding…' : 'Add follow-up'}</button>
    </form>
    {error && <div className="error" role="alert">{error}</div>}
    {items.length ? items.map(item => <article className="memory-row" key={item.id}>
      <div className="memory-row-main"><b>{item.title}</b><span>{item.due_at ? `Due ${new Date(item.due_at).toLocaleString()}` : 'No due date'} · {item.status}</span></div>
      {item.status === 'open' && <button className="button secondary" onClick={() => setStatus(item,'done')}>Mark done</button>}
      {item.status === 'done' && <button className="button ghost" onClick={() => setStatus(item,'open')}>Reopen</button>}
    </article>) : <div className="empty">No follow-ups yet. Add the next action while it is fresh.</div>}
  </section>;
}
