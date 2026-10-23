'use client';

import Link from 'next/link';
import { useState } from 'react';
import { decryptBackup, encryptBackupWithRecovery } from '@/lib/backup-crypto';

type Preview = { applied: boolean; counts: Record<string, number>; attachmentBytes: number };

export default function BackupPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoreRecoveryKey, setRestoreRecoveryKey] = useState('');
  const [restoreMode, setRestoreMode] = useState<'passphrase'|'recovery'>('passphrase');
  const [recoveryKey, setRecoveryKey] = useState('');

  async function readBundle(): Promise<Record<string, unknown>> {
    if (!file) throw new Error('Choose a backup file first');
    const text = await file.text();
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const plaintext = parsed.format === 'memoryscape-encrypted-backup' ? await decryptBackup(text, restoreMode==='recovery'?restoreRecoveryKey:restorePassphrase,globalThis.crypto,restoreMode) : text;
    return JSON.parse(plaintext) as Record<string, unknown>;
  }

  async function downloadEncrypted() {
    setError(''); setStatus(''); setBusy(true);
    try {
      if (passphrase !== confirmPassphrase) throw new Error('Passphrases do not match');
      const response = await fetch('/api/backup/export');
      if (!response.ok) throw new Error('Could not export backup');
      const encrypted = await encryptBackupWithRecovery(await response.text(), passphrase);
      const blob = new Blob([encrypted.envelope], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href=url; anchor.download=`memoryscape-encrypted-backup-${new Date().toISOString().slice(0,10)}.json`; anchor.click();
      URL.revokeObjectURL(url);
      setRecoveryKey(encrypted.recoveryKey);
      setStatus('Encrypted backup downloaded. Store both the passphrase and this recovery key separately from the file.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not encrypt backup'); }
    finally { setBusy(false); }
  }

  async function previewImport() {
    if (!file) return;
    setBusy(true); setError(''); setStatus(''); setPreview(null);
    try {
      const bundle = await readBundle();
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
      const bundle = { ...await readBundle(), apply: true };
      const response = await fetch('/api/backup/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bundle) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? 'Could not restore backup');
      setStatus(`Restored ${Object.values((value.data as Preview).counts).reduce((sum, count) => sum + count, 0)} records. Refresh the app to see them.`);
      setPreview(null); setFile(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not restore backup'); }
    finally { setBusy(false); }
  }

  return <>
    <div className="page-head"><div><div className="eyebrow">PORTABILITY</div><h1>Backup & restore</h1><p>Move your local knowledge archive as a versioned JSON file.</p></div><div className="toolbar" style={{margin:0}}><Link className="button secondary" href="/settings/import">Import files</Link><Link className="button secondary" href="/settings">Settings</Link></div></div>
    {error && <div className="error" role="alert">{error}</div>}{status && <div className="success" role="status">{status}</div>}
    <div className="dashboard-grid">
      <section className="panel"><h2>Download a backup</h2><p>Includes memories, contexts, links, graph edges, reinforcement history, follow-ups, decisions, attachments, place reminders, and review actions.</p><label className="field"><span>Encryption passphrase (12+ characters)</span><input className="input" type="password" autoComplete="new-password" aria-label="Encryption passphrase" value={passphrase} onChange={event=>setPassphrase(event.target.value)} /></label><label className="field"><span>Confirm passphrase</span><input className="input" type="password" autoComplete="new-password" aria-label="Confirm encryption passphrase" value={confirmPassphrase} onChange={event=>setConfirmPassphrase(event.target.value)} /></label><button className="button" onClick={downloadEncrypted} disabled={busy||passphrase.length<12||passphrase!==confirmPassphrase}>{busy?'Encrypting…':'Download encrypted backup'}</button>{recoveryKey&&<div className="field" role="group" aria-label="Backup recovery key"><label htmlFor="backup-recovery-key">One-time recovery key. Save this separately; it is shown only until you leave this page or create another backup.</label><input id="backup-recovery-key" aria-label="Backup recovery key" className="input" value={recoveryKey} readOnly/><button className="button secondary" type="button" onClick={()=>navigator.clipboard.writeText(recoveryKey).then(()=>setStatus('Recovery key copied. Store it separately from the backup file.')).catch(()=>setError('Select and copy the recovery key manually.'))}>Copy recovery key</button></div>}<details style={{marginTop:14}}><summary>Download without encryption</summary><p className="muted">This file contains readable memory text and attachments. Store it somewhere private.</p><a className="button secondary" href="/api/backup/export">Download unencrypted JSON</a></details><p className="muted">Encryption runs in this browser using PBKDF2-SHA-256 and AES-256-GCM. MemoryScape never receives the passphrase or recovery key.</p></section>
      <section className="panel"><h2>Restore a backup</h2><p>Choose a MemoryScape backup. The first step only previews row counts. Restore adds records in one transaction and refuses existing IDs or duplicate context labels.</p>
        <label className="field"><span>Backup JSON (up to 15 MiB)</span><input className="input" type="file" accept="application/json,.json" onChange={event => { setFile(event.target.files?.[0] ?? null); setPreview(null); setError(''); setRestorePassphrase(''); setRestoreRecoveryKey(''); }} /></label>
        <label className="field"><span>Unlock method</span><select className="input" aria-label="Restore key type" value={restoreMode} onChange={event=>setRestoreMode(event.target.value as 'passphrase'|'recovery')}><option value="passphrase">Passphrase</option><option value="recovery">Recovery key</option></select></label>
        {restoreMode==='passphrase'?<label className="field"><span>Passphrase (encrypted files only)</span><input className="input" type="password" autoComplete="current-password" aria-label="Restore passphrase" value={restorePassphrase} onChange={event=>setRestorePassphrase(event.target.value)} /></label>:<label className="field"><span>Recovery key (encrypted files only)</span><input className="input" type="password" autoComplete="current-password" aria-label="Restore recovery key" value={restoreRecoveryKey} onChange={event=>setRestoreRecoveryKey(event.target.value)} /></label>}<button className="button secondary" disabled={!file || busy} onClick={previewImport}>{busy ? 'Checking…' : 'Preview restore'}</button>
        {preview && <div className="algorithm-note" role="status" style={{ marginTop: 12 }}><strong>Preview only. Nothing has been changed.</strong><br />{Object.entries(preview.counts).map(([name, count]) => `${name}: ${count}`).join(' · ')}<br />Attachment data: {(preview.attachmentBytes / 1024).toFixed(1)} KiB
          <div style={{ marginTop: 12 }}><button className="button" disabled={busy} onClick={applyImport}>Restore these records</button></div>
        </div>}
      </section>
    </div>
    <p className="muted">New encrypted backups can be restored with their passphrase or one-time recovery key. Older version 1 encrypted backups require their original passphrase. Unencrypted backups contain sensitive memory text and attachments. Import never overwrites existing records.</p>
  </>;
}
