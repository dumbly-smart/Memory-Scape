'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

function localDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export default function CapturePage() {
  const [occurredAt, setOccurredAt] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setPinned] = useState(false);
  const [isSensitive, setSensitive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState('');

  useEffect(() => {
    setOccurredAt(localDateTime());
    const params = new URLSearchParams(window.location.search);
    setSourceUrl(params.get('url')?.slice(0, 2048) ?? '');
    setSourceTitle(params.get('title')?.slice(0, 500) ?? '');
    setContent(params.get('text')?.slice(0, 20000) ?? '');
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: new FormData(event.currentTarget).get('title') || undefined,
          content,
          occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
          sourceUrl: sourceUrl || undefined,
          sourceTitle: sourceTitle || undefined,
          isPinned,
          isSensitive,
        }),
      });
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
        <div className="toolbar" style={{ alignItems: 'center' }}>
          <label><input type="checkbox" checked={isPinned} onChange={event => setPinned(event.target.checked)} /> Pin as important</label>
          <label><input type="checkbox" checked={isSensitive} onChange={event => setSensitive(event.target.checked)} /> Keep out of review suggestions</label>
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        {savedId && <div className="success" role="status">Saved. You can <Link href={`/memories?memory=${savedId}`}>continue in the library</Link>.</div>}
        <button className="button" type="submit" disabled={saving || (!content.trim() && !sourceUrl.trim())}>{saving ? 'Saving…' : 'Save memory'}</button>
      </form>
    </div>
  </>;
}
