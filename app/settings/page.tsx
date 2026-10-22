'use client';

import { FormEvent, useEffect, useState } from 'react';

type Info = { postgres: string; postgis: string };
type Parameters = {
  valenceBase: number;
  valenceSalience: number;
  reviewStrengthWeight: number;
  reviewAgeWeight: number;
  reviewAgeCapDays: number;
};

export default function SettingsPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [parameters, setParameters] = useState<Parameters | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetch('/api/health'), fetch('/api/settings/algorithms')]).then(async ([healthResponse, parameterResponse]) => {
      const health = await healthResponse.json();
      const parameterResult = await parameterResponse.json();
      if (!healthResponse.ok) throw new Error(health.error ?? 'Database connection failed');
      if (!parameterResponse.ok) throw new Error(parameterResult.error ?? 'Could not load algorithm parameters');
      setInfo(health.database);
      setParameters(parameterResult.data);
    }).catch((cause: Error) => setError(cause.message));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parameters) return;
    setSaving(true); setError(''); setStatus('');
    const form = new FormData(event.currentTarget);
    const value = {
      valenceBase: Number(form.get('valenceBase')),
      valenceSalience: Number(form.get('valenceSalience')),
      reviewStrengthWeight: Number(form.get('reviewStrengthWeight')),
      reviewAgeWeight: Number(form.get('reviewAgeWeight')),
      reviewAgeCapDays: Number(form.get('reviewAgeCapDays')),
    };
    const response = await fetch('/api/settings/algorithms', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setError(result.error ?? 'Could not save parameters'); return; }
    setParameters(result.data); setStatus('Saved algorithm parameters. Refresh the review view to see its new ranking.');
  }

  return <>
    <div className="page-head"><div><div className="eyebrow">DATABASE AND ALGORITHM CONFIGURATION</div><h1>Settings & methods</h1><p>Inspect the database runtime and tune the deterministic recall coefficients.</p></div></div>
    <section className="panel" style={{ marginBottom: 14 }}>
      <div className="panel-title"><h2>Database connection</h2><span className="muted">{info ? 'Connected' : 'Checking…'}</span></div>
      {info && <><p className="muted">{info.postgres}</p><p className="muted">{info.postgis}</p></>}
    </section>
    {error && <div className="error" role="alert">{error}</div>}
    {status && <div className="algorithm-note" role="status">{status}</div>}
    {!parameters && !error && <div className="panel muted">Loading algorithm parameters…</div>}
    {parameters && <form className="panel" onSubmit={save}>
      <div className="panel-title"><h2>Algorithm coefficients</h2><span className="muted">Stored and read by PostgreSQL</span></div>
      <p className="muted">Valence coefficients must sum to 1. Review weights must sum to 1. Changes affect subsequent associative queries and the next materialized-view refresh.</p>
      <div className="dashboard-grid">
        <div>
          <h3>Associative valence factor</h3>
          <div className="field"><label htmlFor="valence-base">Valence base coefficient</label><input id="valence-base" name="valenceBase" className="input" type="number" min="0" max="1" step="0.01" defaultValue={parameters.valenceBase} required /></div>
          <div className="field"><label htmlFor="valence-salience">Valence salience coefficient</label><input id="valence-salience" name="valenceSalience" className="input" type="number" min="0" max="1" step="0.01" defaultValue={parameters.valenceSalience} required /></div>
          <div className="algorithm-note">Activation uses A × edge weight × ({parameters.valenceBase.toFixed(2)} + {parameters.valenceSalience.toFixed(2)} × |valence|) × target strength.</div>
        </div>
        <div>
          <h3>Fading review priority</h3>
          <div className="field"><label htmlFor="review-strength-weight">Review strength weight</label><input id="review-strength-weight" name="reviewStrengthWeight" className="input" type="number" min="0" max="1" step="0.01" defaultValue={parameters.reviewStrengthWeight} required /></div>
          <div className="field"><label htmlFor="review-age-weight">Review age weight</label><input id="review-age-weight" name="reviewAgeWeight" className="input" type="number" min="0" max="1" step="0.01" defaultValue={parameters.reviewAgeWeight} required /></div>
          <div className="field"><label htmlFor="review-age-cap">Review age cap in days</label><input id="review-age-cap" name="reviewAgeCapDays" className="input" type="number" min="1" max="3650" step="1" defaultValue={parameters.reviewAgeCapDays} required /></div>
          <div className="algorithm-note">Priority = {parameters.reviewStrengthWeight.toFixed(2)} × (1 − strength) + {parameters.reviewAgeWeight.toFixed(2)} × capped elapsed days / {parameters.reviewAgeCapDays}.</div>
        </div>
      </div>
      <button className="button" disabled={saving}>{saving ? 'Saving…' : 'Save algorithm parameters'}</button>
    </form>}
    <div className="dashboard-grid" style={{ marginTop: 14 }}>
      <section className="panel"><h2>Temporal decay & reinforcement</h2><div className="algorithm-note">Strength after elapsed time: S(t) = S₀ × exp(−λ × elapsed days).<br/>Reinforcement: S′ = min(1, S + α × (1 − S)).<br/>Default daily decay coefficient λ = 0.01. Default review reinforcement α = 0.2.</div><p className="muted">Decay and reinforcement update last_strength_at in PostgreSQL. Reinforcement rows preserve before and after values.</p></section>
      <section className="panel"><h2>Scheduled database jobs</h2><p className="muted">Daily decay runs at 02:17 UTC. The fading review materialized view refreshes hourly at minute 37. Verify jobs in SQL with <code>SELECT jobname,schedule,command FROM cron.job;</code> and inspect execution history in <code>cron.job_run_details</code>.</p><p className="muted">Spatial maps use OpenStreetMap tiles and therefore need internet access. Coordinates and all recall computation remain local to your PostgreSQL database.</p></section>
    </div>
  </>;
}
