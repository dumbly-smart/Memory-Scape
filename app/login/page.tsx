'use client';

import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) { setError(body.error ?? 'Sign-in failed'); return; }
    const requested = new URLSearchParams(window.location.search).get('next') ?? '/';
    window.location.assign(requested.startsWith('/') && !requested.startsWith('//') ? requested : '/');
  }
  return <main className="panel" style={{ maxWidth: 460, margin: '8vh auto' }}>
    <div className="eyebrow">LOCAL WORKSPACE SIGN-IN</div><h1>Unlock MemoryScape</h1>
    <p className="muted">Use the local password configured by the workspace owner.</p>
    {error && <div className="error" role="alert">{error}</div>}
    <form onSubmit={submit}>
      <div className="field"><label htmlFor="workspace-password">Workspace password</label><input id="workspace-password" name="password" className="input" type="password" autoComplete="current-password" required /></div>
      <button className="button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </main>;
}
