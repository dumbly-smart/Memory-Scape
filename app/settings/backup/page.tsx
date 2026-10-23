'use client';

import Link from 'next/link';
import { useState } from 'react';

type Preview = { applied: boolean; counts: Record<string, number>; attachmentBytes: number };

export default function BackupPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function previewImport() {
    if (!file) return;
    setBusy(true); setError(''); setStatus(''); setPreview(null);
    try {
      const bundle = JSON.parse(await file.text()) as Record<string, unknown>;
      const response = await fetch('/api/backup/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bundle) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? 'Could not inspect backup');
      setPreview(value.data as Preview);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Backup must be a valid MemoryScape JSON export'); }
    finally { setBusy(false); }
  }

  async function applyImport() {
    if (!file) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const bundle = { ...JSON.parse(await file.text()), apply: true };
      const response = await fetch('/api/backup/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bundle) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? 'Could not restore backup');
      setStatus(`Restored ${Object.values((value.data as Preview).counts).reduce((sum, count) => sum + count, 0)} records. Refresh the app to see them.`);
      setPreview(null); setFile(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not restore backup'); }
    finally { setBusy(false); }
  }

  return <>
    <div className="page-head"><div><div className="eyebrow">PORTABILITY</div><h1>Backup & restore</h1><p>Move your local knowledge archive as a versioned JSON file.</p></div><Link className="button secondary" href="/settings">Settings</Link></div>
    {error && <div className="error" role="alert">{error}</div>}{status && <div className="success" role="status">{status}</div>}
    <div className="dashboard-grid">
      <section className="panel"><h2>Download a backup</h2><p>Includes memories, contexts, links, graph edges, reinforcement history, follow-ups, decisions, attachments, place reminders, and review actions.</p><a className="button" href="/api/backup/export">Download JSON backup</a></section>
      <section className="panel"><h2>Restore a backup</h2><p>Choose a MemoryScape backup. The first step only previews row counts. Restore adds records in one transaction and refuses existing IDs or duplicate context labels.</p>
        <label className="field"><span>Backup JSON (up to 15 MiB)</span><input className="input" type="file" accept="application/json,.json" onChange={event => { setFile(event.target.files?.[0] ?? null); setPreview(null); setError(''); }} /></label>
        <button className="button secondary" disabled={!file || busy} onClick={previewImport}>{busy ? 'Checking…' : 'Preview restore'}</button>
        {preview && <div className="algorithm-note" role="status" style={{ marginTop: 12 }}><strong>Preview only. Nothing has been changed.</strong><br />{Object.entries(preview.counts).map(([name, count]) => `${name}: ${count}`).join(' · ')}<br />Attachment data: {(preview.attachmentBytes / 1024).toFixed(1)} KiB
          <div style={{ marginTop: 12 }}><button className="button" disabled={busy} onClick={applyImport}>Restore these records</button></div>
        </div>}
      </section>
    </div>
    <p className="muted">Backups contain the full text of sensitive memories and attachment contents. Keep the downloaded file somewhere private. Import never overwrites existing records.</p>
  </>;
}
