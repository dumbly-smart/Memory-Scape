'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Decision = { id: string; choice: string; rationale: string; alternatives: string; decided_at: string; revisit_at: string | null };
type Props = { memoryId?: string; contextId?: string };

export function DecisionWidget({ memoryId, contextId }: Props) {
  const [items, setItems] = useState<Decision[]>([]);
  const [error, setError] = useState('');
  const key = memoryId ?? contextId ?? '';
  const filter = memoryId ? 'memoryId' : 'contextId';
  const load = useCallback(async () => {
    if (!key) return;
    const response = await fetch(`/api/decisions?${filter}=${key}`);
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? 'Could not load decisions');
    setItems(value.data as Decision[]);
  }, [filter,key]);
  useEffect(() => { load().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load decisions')); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      choice: data.get('choice'), rationale: data.get('rationale'), alternatives: data.get('alternatives'),
      revisitAt: data.get('revisitAt') ? new Date(String(data.get('revisitAt'))).toISOString() : null,
      ...(memoryId ? { memoryId } : { contextId }),
    };
    const response = await fetch('/api/decisions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? 'Could not save decision'); return; }
    form.reset(); await load();
  }

  return <section className="panel" aria-label="Decision records">
    <div className="panel-title"><h2>Decisions</h2><span className="muted">Choice, reasoning, and revisit date</span></div>
    <form onSubmit={save}>
      <div className="field"><label htmlFor={`decision-choice-${key}`}>Decision choice</label><input id={`decision-choice-${key}`} name="choice" className="input" maxLength={1000} required placeholder="What did you decide?" /></div>
      <div className="field"><label htmlFor={`decision-rationale-${key}`}>Decision rationale</label><textarea id={`decision-rationale-${key}`} name="rationale" rows={2} maxLength={10000} required placeholder="Why did you choose it?" /></div>
      <div className="field"><label htmlFor={`decision-alternatives-${key}`}>Alternatives considered</label><textarea id={`decision-alternatives-${key}`} name="alternatives" rows={2} maxLength={10000} placeholder="What else did you consider?" /></div>
      <div className="field"><label htmlFor={`decision-revisit-${key}`}>Revisit on</label><input id={`decision-revisit-${key}`} className="input" name="revisitAt" type="datetime-local" /></div>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="button secondary">Save decision</button>
    </form>
    {items.map(item => <article className="result-card" key={item.id}><b>{item.choice}</b><p>{item.rationale}</p>{item.alternatives && <span>Considered: {item.alternatives}</span>}{item.revisit_at && <span> · Revisit {new Date(item.revisit_at).toLocaleDateString()}</span>}</article>)}
    {!items.length && <div className="empty">No decisions recorded here.</div>}
  </section>;
}
