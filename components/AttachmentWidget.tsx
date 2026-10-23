'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Attachment = { id: string; file_name: string; media_type: string; size_bytes: number; sha256: string; created_at: string };

export function AttachmentWidget({ memoryId }: { memoryId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(`/api/memories/${memoryId}/attachments`);
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? 'Could not load attachments');
    setItems(value.data as Attachment[]);
  }, [memoryId]);
  useEffect(() => { load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load attachments')); }, [load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem('file');
    const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : undefined;
    if (!file) { setError('Choose a file first'); setBusy(false); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Each file must be 10 MiB or smaller'); setBusy(false); return; }
    const response = await fetch(`/api/memories/${memoryId}/attachments`, { method: 'POST', body: new FormData(form) });
    const value = await response.json();
    setBusy(false);
    if (!response.ok) { setError(value.error ?? 'Could not upload attachment'); return; }
    form.reset(); await load();
  }

  async function remove(item: Attachment) {
    const response = await fetch(`/api/attachments/${item.id}`, { method: 'DELETE' });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? 'Could not remove attachment'); return; }
    await load();
  }

  return <section className="panel" aria-label="Attachments">
    <div className="panel-title"><h2>Files and sources</h2><span className="muted">Up to 10 MiB per file</span></div>
    <form onSubmit={upload} className="toolbar" style={{ flexWrap: 'wrap' }}>
      <input aria-label="Attachment file" name="file" type="file" required accept="image/*,.pdf,.txt,.md,.csv,.json,.xml" />
      <button className="button secondary" disabled={busy}>{busy ? 'Uploading…' : 'Add attachment'}</button>
    </form>
    {error && <div role="alert" className="error">{error}</div>}
    {items.map(item => <article className="memory-row" key={item.id}>
      <div className="memory-row-main"><b>{item.file_name}</b><span>{item.media_type} · {(item.size_bytes / 1024).toFixed(1)} KiB · SHA-256 {item.sha256.slice(0,12)}…</span></div>
      <a className="button secondary" href={`/api/attachments/${item.id}`}>Download</a>
      <button className="button ghost" onClick={() => remove(item)} aria-label={`Delete ${item.file_name}`}>Delete</button>
    </article>)}
    {!items.length && <div className="empty">No files attached. Text files are indexed for ordinary database search.</div>}
  </section>;
}
