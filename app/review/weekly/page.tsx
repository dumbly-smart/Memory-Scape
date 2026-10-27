'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

type Item = {
  kind: 'memory' | 'follow_up';
  id: string;
  title: string;
  description: string;
  occurred_at: string;
  due_at: string | null;
  strength: number | null;
  review_priority: number;
  reasons: string[];
  memory_id: string | null;
  context_label: string | null;
};
type ReviewAction = 'keep' | 'snooze' | 'archive' | 'dismiss';

export default function WeeklyReviewPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<-1 | 1 | null>(null);
  const pointerStart = useRef<{ id: number; x: number } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/review/weekly');
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? 'Could not load weekly review');
    setItems(value.data as Item[]);
    setSessionTotal((value.data as Item[]).length);
  }, []);

  useEffect(() => {
    load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load weekly review')).finally(() => setLoading(false));
  }, [load]);

  async function act(item: Item, action: ReviewAction) {
    if (busy) return;
    setBusy(true);
    setError('');
    setStatus('');
    setExitDirection(action === 'keep' ? 1 : action === 'archive' || action === 'dismiss' ? -1 : null);
    try {
      const response = await fetch('/api/review/weekly/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: item.kind, id: item.id, action, snoozeDays: 7 }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? 'Could not save review action');
      if (action !== 'snooze') await new Promise(resolve => setTimeout(resolve, 220));
      setItems(current => current.filter(candidate => candidate.id !== item.id || candidate.kind !== item.kind));
      setCompleted(current => current + 1);
      const description = action === 'keep'
        ? item.kind === 'memory' ? 'kept and pinned' : 'kept for later'
        : action === 'snooze' ? 'snoozed for seven days' : action === 'archive' ? 'archived' : 'dismissed';
      setStatus(`${item.title}: ${description}.`);
      setDragOffset(0);
      setExitDirection(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save review action');
      setDragOffset(0);
      setExitDirection(null);
    } finally {
      setBusy(false);
    }
  }

  function beginDrag(event: PointerEvent<HTMLElement>) {
    if (busy || event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, textarea, select')) return;
    pointerStart.current = { id: event.pointerId, x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setDragOffset(0);
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    if (pointerStart.current?.id !== event.pointerId) return;
    setDragOffset(Math.max(-260, Math.min(260, event.clientX - pointerStart.current.x)));
  }

  function finishDrag(event: PointerEvent<HTMLElement>, item: Item) {
    if (pointerStart.current?.id !== event.pointerId) return;
    const distance = event.clientX - pointerStart.current.x;
    pointerStart.current = null;
    setDragging(false);
    if (distance >= 110) {
      void act(item, 'keep');
    } else if (distance <= -110) {
      void act(item, 'archive');
    } else {
      setDragOffset(0);
    }
  }

  const item = items[0];
  const cardTransform = exitDirection
    ? `translate3d(${exitDirection * 115}vw, 0, 0) rotate(${exitDirection * 8}deg)`
    : `translate3d(${dragOffset}px, 0, 0) rotate(${dragOffset / 32}deg)`;
  const cardStyle = { transform: cardTransform, opacity: exitDirection ? 0 : 1, transition: dragging ? 'none' : undefined };

  return <>
    <div className="page-head weekly-review-head">
      <div><div className="eyebrow">WEEKLY RESET</div><h1>Weekly review</h1><p>One memory at a time. Keep it close, set it aside, or clear it from review.</p></div>
      <Link className="button secondary" href="/review">Fading memories</Link>
    </div>
    {error && <div role="alert" className="error">{error}</div>}
    {status && <div role="status" className="success weekly-action-status">{status}</div>}

    {loading ? <div className="empty" role="status">Loading weekly review…</div> : item ? <main className="weekly-review-stage">
      <div className="weekly-review-topline">
        <span className="weekly-progress" data-testid="weekly-progress">Review {completed + 1} of {sessionTotal}</span>
        <span className="weekly-review-caption">Take a moment with this one</span>
      </div>
      <article
        className={`panel weekly-card ${dragging ? 'is-dragging' : ''} ${exitDirection === 1 ? 'is-keeping' : exitDirection === -1 ? 'is-archiving' : ''}`}
        data-testid="weekly-card"
        aria-label={`${item.kind === 'memory' ? 'Memory' : 'Follow-up'} review card`}
        style={cardStyle}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={event => finishDrag(event, item)}
        onPointerCancel={() => { pointerStart.current = null; setDragging(false); setDragOffset(0); }}
      >
        <div className="weekly-card-meta"><span className={`weekly-kind weekly-kind--${item.kind}`}>{item.kind === 'memory' ? 'MEMORY' : 'FOLLOW-UP'}</span><span>Priority {Number(item.review_priority).toFixed(2)}</span></div>
        <div className="weekly-card-body">
          <h2>{item.title}</h2>
          <p className="weekly-card-description">{item.description || 'No additional details.'}</p>
          <div className="weekly-card-context">
            {item.reasons.join(' · ')}
            {item.due_at ? ` · Due ${new Date(item.due_at).toLocaleString()}` : ` · ${new Date(item.occurred_at).toLocaleDateString()}`}
            {item.strength !== null ? ` · Strength ${Math.round(item.strength * 100)}%` : ''}
            {item.context_label ? ` · ${item.context_label}` : ''}
          </div>
          {item.memory_id && <Link className="weekly-open-memory" href={`/memories?memory=${item.memory_id}`}>Open linked memory <span aria-hidden="true">↗</span></Link>}
        </div>
        {Math.abs(dragOffset) > 26 && <div className={`weekly-swipe-stamp ${dragOffset > 0 ? 'is-keep' : 'is-archive'}`} aria-hidden="true">{dragOffset > 0 ? 'KEEP' : 'ARCHIVE'}</div>}
        <div className="weekly-card-actions" onPointerDown={event => event.stopPropagation()}>
          <button className="button weekly-keep-button" disabled={busy} onClick={() => void act(item, 'keep')}><span aria-hidden="true">✓</span> Keep</button>
          <button className="button secondary" disabled={busy} onClick={() => void act(item, 'snooze')}>Snooze</button>
          <button className="button secondary" disabled={busy} onClick={() => void act(item, 'archive')}>Archive</button>
          <button className="button ghost" disabled={busy} onClick={() => void act(item, 'dismiss')}>Dismiss</button>
        </div>
      </article>
      <div className="weekly-swipe-guide"><span>← Swipe left to archive</span><span>Swipe right to keep →</span></div>
    </main> : <div className="panel weekly-empty-state"><span className="weekly-empty-mark">✓</span><h2>You’re all caught up</h2><p>New memories and due actions will appear here when they are ready for review.</p><Link href="/memories" className="button secondary">Browse memories</Link></div>}
  </>;
}
