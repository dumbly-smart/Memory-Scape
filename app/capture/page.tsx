'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { buildCaptureBookmarklet } from '@/lib/bookmarklet';
import { CaptureDraft, listQueuedCaptures, enqueueCapture, syncQueuedCaptures } from '@/lib/offline-capture';

function localDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export default function CapturePage() {
  const [occurredAt, setOccurredAt] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [contextId, setContextId] = useState('');
  const [contextLabel, setContextLabel] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setPinned] = useState(false);
  const [isSensitive, setSensitive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState('');
  const [bookmarklet, setBookmarklet] = useState('');
  const [bookmarkletStatus, setBookmarkletStatus] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [queueStatus, setQueueStatus] = useState('');

  useEffect(() => {
    setOccurredAt(localDateTime());
    void listQueuedCaptures().then(items => {
      setPendingCount(items.length);
      if (navigator.onLine && items.length) void syncOfflineQueue();
    }).catch(() => setPendingCount(0));
    window.addEventListener('online', syncOfflineQueue);
    setBookmarklet(buildCaptureBookmarklet(window.location.origin));
    const params = new URLSearchParams(window.location.search);
    setSourceUrl(params.get('url')?.slice(0, 2048) ?? '');
    setSourceTitle(params.get('title')?.slice(0, 500) ?? '');
    setContent(params.get('text')?.slice(0, 20000) ?? '');
    const candidateContext = params.get('context') ?? '';
    const selectedContext = /^[0-9a-f-]{36}$/i.test(candidateContext) ? candidateContext : '';
    setContextId(selectedContext);
    if (selectedContext) fetch(`/api/contexts/${selectedContext}`).then(response => response.json()).then(body => setContextLabel(body.data?.label ?? '')).catch(() => setContextLabel(''));
    return () => window.removeEventListener('online', syncOfflineQueue);
  }, []);

  async function syncOfflineQueue() {
    try {
      const result = await syncQueuedCaptures();
      setPendingCount(result.remaining);
      if (result.synced) setQueueStatus(`Synced ${result.synced} offline capture${result.synced === 1 ? '' : 's'}.`);
      if (result.failed) setError(result.failed);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sync offline captures'); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setQueueStatus('');
    try {
      const form = new FormData(event.currentTarget);
      const payload: CaptureDraft = {
        title: String(form.get('title') || '').trim() || undefined,
        content,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
        sourceUrl: sourceUrl || undefined,
        sourceTitle: sourceTitle || undefined,
        contextId: contextId || undefined,
        isPinned,
        isSensitive,
      };
      const captureKey = crypto.randomUUID();
      if (!navigator.onLine) {
        if (isSensitive) throw new Error('Sensitive notes cannot be queued offline because browser storage is not encrypted');
        await enqueueCapture(payload, captureKey);
        setPendingCount((count) => count + 1);
        setQueueStatus('Saved on this device; waiting to sync');
        setContent('');
        return;
      }
      let response: Response;
      try {
        response = await fetch('/api/capture', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, captureKey }) });
      } catch (cause) {
        if (!(cause instanceof TypeError) || isSensitive) throw cause;
        await enqueueCapture(payload, captureKey);
        setPendingCount((count) => count + 1);
        setQueueStatus('Saved on this device; waiting to sync');
        setContent('');
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not save this memory');
      setSavedId(result.data.id as string);
      setContent('');
      setSourceUrl('');
      setSourceTitle('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this memory');
    } finally {
      setSaving(false);
    }
  }

  async function copyBookmarklet() {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setBookmarkletStatus('Copied. Create a browser bookmark and paste this into its URL field.');
    } catch {
      setBookmarkletStatus('Select and copy the bookmarklet text, then paste it into a browser bookmark URL field.');
    }
  }

  return <>
    <div className="page-head"><div><div className="eyebrow">CAPTURE</div><h1>Quick capture</h1><p>Save the thought first. Add context whenever you need it.</p></div><Link className="button secondary" href="/memories">Memory library</Link></div>
    <div className="panel" style={{ maxWidth: 760 }}>
      <form onSubmit={save}>
        <label className="field"><span>Title <span className="muted">(optional)</span></span><input className="input" name="title" maxLength={500} placeholder="A title will come from your first line" /></label>
        <label className="field"><span>Thought, quote, or note</span><textarea aria-label="Thought, quote, or note" value={content} onChange={event => setContent(event.target.value)} maxLength={20000} rows={8} placeholder="Type or paste something you want to remember…" /></label>
        <div className="toolbar">
          <label className="field" style={{ flex: 1 }}><span>When it happened</span><input className="input" aria-label="When it happened" type="datetime-local" value={occurredAt} onChange={event => setOccurredAt(event.target.value)} /></label>
          <label className="field" style={{ flex: 1 }}><span>Source URL <span className="muted">(optional)</span></span><input className="input" aria-label="Source URL" type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} maxLength={2048} placeholder="https://…" /></label>
        </div>
        {sourceTitle && <p className="muted">Saved from: {sourceTitle}</p>}
        {contextLabel && <p className="algorithm-note">This memory will be linked to {contextLabel}.</p>}
        <div className="toolbar" style={{ alignItems: 'center' }}>
          <label><input type="checkbox" checked={isPinned} onChange={event => setPinned(event.target.checked)} /> Pin as important</label>
          <label><input type="checkbox" checked={isSensitive} onChange={event => setSensitive(event.target.checked)} /> Keep out of review suggestions</label>
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        {queueStatus && <div className="success" role="status">{queueStatus}</div>}
        {savedId && <div className="success" role="status">Saved. You can <Link href={`/memories?memory=${savedId}`}>continue in the library</Link>.</div>}
        {pendingCount > 0 && <div className="algorithm-note" aria-live="polite">{pendingCount} offline capture{pendingCount === 1 ? '' : 's'} waiting on this device. Drafts in browser storage are not encrypted; do not queue sensitive notes.</div>}
        <button className="button" type="submit" disabled={saving || (!content.trim() && !sourceUrl.trim())}>{saving ? 'Saving…' : 'Save memory'}</button>
      </form>
    </div>
    <section className="panel" style={{ maxWidth: 760, marginTop: 16 }} aria-label="Browser capture bookmarklet">
      <div className="panel-title"><h2>Save from your browser</h2><span className="muted">No extension or external service</span></div>
      <p className="muted">Copy this code into a new browser bookmark’s URL field. On a page, select text and click that bookmark to open a reviewable draft here.</p>
      <label className="field"><span>Bookmarklet URL</span><textarea aria-label="Bookmarklet URL" readOnly rows={3} value={bookmarklet} /></label>
      <button className="button secondary" onClick={copyBookmarklet} disabled={!bookmarklet}>Copy bookmarklet URL</button>
      {bookmarkletStatus && <p className="success" role="status">{bookmarkletStatus}</p>}
    </section>
  </>;
}
