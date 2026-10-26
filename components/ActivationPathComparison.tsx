'use client';

import { useState } from 'react';

type ActivationPath = {
  path_rank: number;
  activation: number;
  hop_depth: number;
  path_titles: string[];
  edge_types: string[];
  edge_weights: number[];
  edge_valences: number[];
  step_activations: number[];
};

export function ActivationPathComparison({ seedId, targetId, depth, threshold }: {
  seedId: string;
  targetId: string;
  depth: number;
  threshold: number;
}) {
  const [paths, setPaths] = useState<ActivationPath[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/associative/paths', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seedId, targetId, depth, threshold, limit: 5 }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? 'Could not compare activation paths');
      setPaths(value.data as ActivationPath[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not compare activation paths');
    } finally {
      setBusy(false);
    }
  }

  return <div style={{ marginTop: 8 }}>
    <button className="button ghost" disabled={busy} onClick={() => void load()}>{busy ? 'Comparing paths…' : 'Inspect alternate paths'}</button>
    {error && <div className="error" role="alert">{error}</div>}
    {paths && <section aria-label="Alternate activation paths" className="algorithm-note" style={{ marginTop: 8 }}>
      <b>{paths.length ? `${paths.length} strongest valid path${paths.length === 1 ? '' : 's'}` : 'No valid paths at this threshold'}</b>
      {paths.map(path => <div key={`${path.path_rank}-${path.path_titles.join('|')}`} style={{ marginTop: 8 }}>
        <b>Path {path.path_rank} · activation {Number(path.activation).toFixed(5)} · {path.hop_depth} hops</b>
        <div>{path.path_titles.join(' → ')}</div>
        <div className="muted">{path.edge_types.join(' → ')} · weights {path.edge_weights.map(weight => Number(weight).toFixed(2)).join(' × ')} · valence {path.edge_valences.map(valence => Number(valence).toFixed(1)).join(', ')}</div>
        <div className="muted">Activation by step: {path.step_activations.map(score => Number(score).toFixed(5)).join(' → ')}</div>
      </div>)}
    </section>}
  </div>;
}
