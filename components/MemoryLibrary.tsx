'use client';

import { FormEvent, useEffect, useState } from 'react';

type Context = { id: string; type: string; label: string };
type Association = { id: string; memoryId: string; direction: string; type: string; weight: number; valence: number };
type Reinforcement = { id: string; reinforcement_type: string; strength_before: number; strength_after: number; reinforcement_amount: number; created_at: string };
type Memory = { id: string; title: string; content: string; occurred_at: string; last_strength_at?: string; strength: number; decay_rate?: number; location_label: string | null; latitude: number | null; longitude: number | null; contexts?: Context[]; associations?: Association[]; reinforcements?: Reinforcement[] };
const contextTypes = ['Person', 'Place', 'Topic', 'Activity', 'Project', 'Emotion', 'Event', 'Custom'];

export function MemoryLibrary() {
  const [rows, setRows] = useState<Memory[]>([]);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [contextId, setContextId] = useState('');
  const [minStrength, setMinStrength] = useState('');
  const [hasLocation, setHasLocation] = useState('');
  const [sort, setSort] = useState('occurred_desc');
  const [contexts, setContexts] = useState<Context[]>([]);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Memory | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const params = new URLSearchParams({ q, sort });
    if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) params.set('to', new Date(`${to}T23:59:59.999`).toISOString());
    if (contextId) params.set('context', contextId);
    if (minStrength) params.set('minStrength', minStrength);
    if (hasLocation) params.set('hasLocation', hasLocation);
    const response = await fetch('/api/memories?' + params.toString(), { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setRows(body.data);
  }
  useEffect(() => { load().catch((e: Error) => setError(e.message)); }, [q, from, to, contextId, minStrength, hasLocation, sort]);
  useEffect(() => { fetch('/api/contexts').then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error); setContexts(body.data); }).catch((e: Error) => setError(e.message)); }, []);

  async function openMemory(memory: Memory) {
    setError('');
    setEditing(false);
    const response = await fetch(`/api/memories/${memory.id}`);
    const body = await response.json();
    if (!response.ok) { setError(body.error); return; }
    setSelected(body.data);
  }

  async function saveNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const contextLabel = String(form.get('contextLabel') ?? '').trim();
    const payload = {
      title: form.get('title'), content: form.get('content'),
      contexts: contextLabel ? [{ type: form.get('contextType'), label: contextLabel }] : [],
      occurredAt: new Date(String(form.get('occurredAt'))).toISOString(),
      latitude: form.get('latitude') ? Number(form.get('latitude')) : null,
      longitude: form.get('longitude') ? Number(form.get('longitude')) : null,
      locationLabel: form.get('locationLabel') || null, strength: Number(form.get('strength')),
    };
    const response = await fetch('/api/memories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) { setError(body.error ?? 'Could not save memory'); return; }
    setModal(false); formElement.reset(); await load();
  }

  async function updateMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const payload = {
      title: form.get('title'), content: form.get('content'),
      occurredAt: new Date(String(form.get('occurredAt'))).toISOString(),
      latitude: form.get('latitude') ? Number(form.get('latitude')) : null,
      longitude: form.get('longitude') ? Number(form.get('longitude')) : null,
      locationLabel: form.get('locationLabel') || null,
      strength: Number(form.get('strength')), decayRate: Number(form.get('decayRate')),
    };
    const response = await fetch(`/api/memories/${selected.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) { setError(body.error); return; }
    await load(); await openMemory(body.data);
  }

  async function reinforce(id: string) {
    const response = await fetch('/api/temporal/reinforce', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ memoryId: id }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error); return; }
    await load(); if (selected?.id === id) await openMemory(body.data);
  }

  async function deleteMemory() {
    if (!selected || !window.confirm(`Delete “${selected.title}”? This also deletes its contexts and associations.`)) return;
    const response = await fetch(`/api/memories/${selected.id}`, { method: 'DELETE' });
    const body = await response.json();
    if (!response.ok) { setError(body.error); return; }
    setSelected(null); await load();
  }

  async function addContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch('/api/contexts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ memoryId: selected.id, type: form.get('type'), label: form.get('label') }) });
    const body = await response.json(); if (!response.ok) { setError(body.error); return; }
    formElement.reset(); await openMemory(selected);
  }

  async function addAssociation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch('/api/edges', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ src: selected.id, dst: form.get('dst'), type: form.get('type'), weight: Number(form.get('weight')), valence: Number(form.get('valence')) }) });
    const body = await response.json(); if (!response.ok) { setError(body.error); return; }
    formElement.reset(); await openMemory(selected);
  }

  async function removeAssociation(id: string) {
    const response = await fetch(`/api/edges/${id}`, { method: 'DELETE' });
    const body = await response.json(); if (!response.ok) { setError(body.error); return; }
    if (selected) await openMemory(selected);
  }

  async function removeContext(contextId: string) {
    if (!selected) return;
    const response = await fetch(`/api/memories/${selected.id}/contexts/${contextId}`, { method: 'DELETE' });
    const body = await response.json(); if (!response.ok) { setError(body.error); return; }
    await openMemory(selected);
  }

  const dateInput = (value: string) => new Date(value).toISOString().slice(0, 16);
  return <>
    <div className="page-head"><div><div className="eyebrow">PERSONAL KNOWLEDGE BASE</div><h1>Memory library</h1><p>Episodes, observations, and knowledge connected to time and place.</p></div><button className="button" onClick={() => setModal(true)}>＋ New memory</button></div>
    <div className="toolbar" style={{ flexWrap: 'wrap' }}><input className="input" aria-label="Search memories" placeholder="Search memories…" value={q} onChange={e => setQ(e.target.value)} /><label className="muted">From <input className="input" aria-label="Filter from date" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="muted">To <input className="input" aria-label="Filter to date" type="date" value={to} onChange={e => setTo(e.target.value)} /></label><select aria-label="Filter by context" value={contextId} onChange={e => setContextId(e.target.value)}><option value="">All contexts</option>{contexts.map(c => <option key={c.id} value={c.id}>{c.type}: {c.label}</option>)}</select><select aria-label="Minimum strength" value={minStrength} onChange={e => setMinStrength(e.target.value)}><option value="">Any strength</option><option value="0.25">At least 25%</option><option value="0.5">At least 50%</option><option value="0.75">At least 75%</option></select><select aria-label="Location filter" value={hasLocation} onChange={e => setHasLocation(e.target.value)}><option value="">Any location</option><option value="true">Has location</option><option value="false">No location</option></select><select aria-label="Sort memories" value={sort} onChange={e => setSort(e.target.value)}><option value="occurred_desc">Newest first</option><option value="occurred_asc">Oldest first</option><option value="strength_desc">Strongest first</option><option value="strength_asc">Weakest first</option></select><span className="muted" style={{ alignSelf: 'center' }}>{rows.length} results</span></div>
    {error && <div className="error" role="alert">{error}</div>}
    <div className="panel">{rows.length ? <div className="table-scroll" role="region" aria-label="Memories"><table className="responsive-table"><thead><tr><th>MEMORY</th><th>EVENT TIME</th><th>LOCATION</th><th>STRENGTH</th><th>RECALL</th></tr></thead><tbody>{rows.map(m => <tr key={m.id}><td><button className="button ghost" style={{ padding: 0, textAlign: 'left' }} onClick={() => openMemory(m)}>{m.title}</button></td><td>{new Date(m.occurred_at).toLocaleString()}</td><td>{m.location_label ?? '—'}</td><td>{Math.round(m.strength * 100)}%</td><td><button className="button secondary" onClick={() => reinforce(m.id)}>Reinforce</button></td></tr>)}</tbody></table></div> : <div className="empty">No memories match. Create one or run <code>npm run db:seed</code> for a synthetic dataset.</div>}</div>

    {modal && <div className="modal-backdrop" onClick={() => setModal(false)}><form className="modal" aria-label="Capture memory form" onSubmit={saveNew} onClick={e => e.stopPropagation()}>
      <h2>Capture a memory</h2>
      <div className="field"><label htmlFor="new-title">Title</label><input id="new-title" className="input" name="title" required maxLength={240} /></div>
      <div className="field"><label htmlFor="new-content">What happened?</label><textarea id="new-content" name="content" rows={4} maxLength={20000} /></div>
      <div className="field"><label htmlFor="new-occurred">Event date and time</label><input id="new-occurred" className="input" name="occurredAt" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} /></div>
      <div className="field"><label htmlFor="new-location-label">Place name</label><input id="new-location-label" className="input" name="locationLabel" placeholder="Library, campus…" /></div>
      <div style={{ display: 'flex', gap: 8 }}><div className="field" style={{ flex: 1 }}><label htmlFor="new-lat">Latitude</label><input id="new-lat" className="input" name="latitude" type="number" min={-90} max={90} step="any" /></div><div className="field" style={{ flex: 1 }}><label htmlFor="new-lon">Longitude</label><input id="new-lon" className="input" name="longitude" type="number" min={-180} max={180} step="any" /></div></div>
      <div style={{ display: 'flex', gap: 8 }}><div className="field" style={{ flex: 1 }}><label htmlFor="new-context-type">Context type</label><select id="new-context-type" name="contextType">{contextTypes.map(t => <option key={t}>{t}</option>)}</select></div><div className="field" style={{ flex: 2 }}><label htmlFor="new-context-label">Context label</label><input id="new-context-label" className="input" name="contextLabel" placeholder="PostgreSQL, library…" /></div></div>
      <div className="field"><label htmlFor="new-strength">Initial strength</label><input id="new-strength" className="input" name="strength" type="number" min="0" max="1" step=".01" defaultValue="1" /></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="button secondary" onClick={() => setModal(false)}>Cancel</button><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save memory'}</button></div>
    </form></div>}

    {selected && <div className="modal-backdrop" onClick={() => { setSelected(null); setEditing(false); }}><div className="modal" role="dialog" aria-label="Memory details" onClick={e => e.stopPropagation()}>
      <div className="panel-title"><h2>{selected.title}</h2><button aria-label="Close memory details" className="button ghost" onClick={() => setSelected(null)}>×</button></div>
      {editing ? <form onSubmit={updateMemory}>
        <div className="field"><label htmlFor="edit-title">Title</label><input id="edit-title" className="input" name="title" required defaultValue={selected.title} /></div>
        <div className="field"><label htmlFor="edit-content">What happened?</label><textarea id="edit-content" name="content" rows={4} defaultValue={selected.content} /></div>
        <div className="field"><label htmlFor="edit-occurred">Event date and time</label><input id="edit-occurred" className="input" name="occurredAt" type="datetime-local" required defaultValue={dateInput(selected.occurred_at)} /></div>
        <div className="field"><label htmlFor="edit-location">Place name</label><input id="edit-location" className="input" name="locationLabel" defaultValue={selected.location_label ?? ''} /></div>
        <div style={{ display: 'flex', gap: 8 }}><div className="field" style={{ flex: 1 }}><label htmlFor="edit-lat">Latitude</label><input id="edit-lat" className="input" name="latitude" type="number" min={-90} max={90} step="any" defaultValue={selected.latitude ?? ''} /></div><div className="field" style={{ flex: 1 }}><label htmlFor="edit-lon">Longitude</label><input id="edit-lon" className="input" name="longitude" type="number" min={-180} max={180} step="any" defaultValue={selected.longitude ?? ''} /></div></div>
        <div style={{ display: 'flex', gap: 8 }}><div className="field" style={{ flex: 1 }}><label htmlFor="edit-strength">Strength</label><input id="edit-strength" className="input" name="strength" type="number" min="0" max="1" step=".01" defaultValue={selected.strength} /></div><div className="field" style={{ flex: 1 }}><label htmlFor="edit-decay">Decay rate per day</label><input id="edit-decay" className="input" name="decayRate" type="number" min="0" max="10" step=".001" defaultValue={selected.decay_rate ?? 0.01} /></div></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="button secondary" onClick={() => setEditing(false)}>Cancel edit</button><button className="button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form> : <>
        <p>{selected.content || 'No additional notes.'}</p><div className="algorithm-note">Event: {new Date(selected.occurred_at).toLocaleString()} · Strength: {Math.round(selected.strength * 100)}% · {selected.location_label ?? 'No location'}<br />Strength state updated: {selected.last_strength_at ? new Date(selected.last_strength_at).toLocaleString() : '—'}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button className="button" onClick={() => reinforce(selected.id)}>Reinforce memory</button><button className="button secondary" onClick={() => setEditing(true)}>Edit memory</button><button className="button secondary" onClick={deleteMemory}>Delete memory</button></div>
        <h3>Contexts</h3>{selected.contexts?.map(c => <span key={c.id} className="quick" style={{ display: 'inline-flex', margin: '0 5px 5px 0', alignItems: 'center', gap: 6 }}>{c.type}: {c.label}<button aria-label={`Remove ${c.label} context`} className="button ghost" onClick={() => removeContext(c.id)}>×</button></span>)}
        <form onSubmit={addContext} style={{ display: 'flex', gap: 6, marginTop: 8 }}><select name="type" aria-label="New context type">{contextTypes.map(t => <option key={t}>{t}</option>)}</select><input className="input" name="label" aria-label="New context label" placeholder="Add context" required /><button className="button secondary">Add</button></form>
        <h3>Associations</h3>{selected.associations?.map(edge => <div className="result-card" key={edge.id}><b>{edge.direction === 'out' ? '→' : '←'} {rows.find(m => m.id === edge.memoryId)?.title ?? edge.memoryId}</b><span>{edge.type} · weight {edge.weight} · valence {edge.valence}</span><button className="button ghost" onClick={() => removeAssociation(edge.id)}>Remove</button></div>)}
        <form onSubmit={addAssociation} className="toolbar" style={{ flexWrap: 'wrap' }}><select name="dst" aria-label="Associated memory" required defaultValue=""><option value="" disabled>Choose memory</option>{rows.filter(m => m.id !== selected.id).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select><input className="input" name="type" aria-label="Relationship type" required defaultValue="Associated with" /><input className="input" name="weight" aria-label="Relationship weight" type="number" min="0" max="1" step=".05" defaultValue=".5" /><input className="input" name="valence" aria-label="Relationship valence" type="number" min="-1" max="1" step=".1" defaultValue="0" /><button className="button secondary">Link memory</button></form>
        <h3>Reinforcement history</h3>{selected.reinforcements?.length ? selected.reinforcements.map(r => <div className="result-card" key={r.id}><b>{r.reinforcement_type}</b><span>{Math.round(r.strength_before * 100)}% → {Math.round(r.strength_after * 100)}% · {new Date(r.created_at).toLocaleString()}</span></div>) : <div className="muted">No reinforcement events.</div>}
      </>}
    </div></div>}
  </>;
}
