'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

type Location = { latitude: number; longitude: number };
type Result = { kind: 'memory'|'reminder'; id: string; title: string; content: string; location_label: string | null; distance_m: number; occurred_at: string; strength: number; is_pinned: boolean };
type Memory = { id: string; title: string; is_sensitive: boolean; archived_at: string | null };

export default function NearbyPage() {
  const [location, setLocation] = useState<Location | null>(null);
  const [radius, setRadius] = useState(1000);
  const [results, setResults] = useState<Result[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState('');
  const [reminderTitle, setReminderTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  async function loadNearby(point: Location, distance = radius) {
    const response = await fetch(`/api/places/nearby?latitude=${point.latitude}&longitude=${point.longitude}&radiusMeters=${distance}`);
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? 'Could not find nearby memories');
    setResults(value.data as Result[]);
  }

  async function checkLocation() {
    setError(''); setStatus(''); setLoading(true);
    if (!navigator.geolocation) { setError('This browser does not provide location access. You can still browse the memory library.'); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(async position => {
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setLocation(point);
      try {
        const [, memoriesResponse] = await Promise.all([loadNearby(point), fetch('/api/memories?hasLocation=true&limit=200')]);
        const memoryPayload = await memoriesResponse.json();
        const eligible = (memoryPayload.data as Memory[]).filter(memory => !memory.is_sensitive && !memory.archived_at);
        setMemories(eligible);
        setSelectedMemory(current => current || eligible[0]?.id || '');
        setStatus('Nearby results are ordered by PostGIS distance from your current location.');
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load nearby memories'); }
      finally { setLoading(false); }
    }, cause => {
      setError(cause.code === cause.PERMISSION_DENIED ? 'Location permission was denied. You can keep using MemoryScape without location access.' : 'Could not read your location.');
      setLoading(false);
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }

  async function saveReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location || !selectedMemory) return;
    const response = await fetch('/api/place-reminders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ memoryId: selectedMemory, title: reminderTitle, latitude: location.latitude, longitude: location.longitude, radiusMeters: radius, locationLabel: 'Current place' }) });
    const value = await response.json();
    if (!response.ok) { setError(value.error ?? 'Could not save place reminder'); return; }
    setReminderTitle(''); setStatus('Place reminder saved. It will appear when you choose to check this place again.');
    await loadNearby(location);
  }

  return <>
    <div className="page-head"><div><div className="eyebrow">SPATIAL RECALL</div><h1>What’s relevant here?</h1><p>Check nearby memories when you choose. Location is never checked in the background.</p></div><Link href="/spatial" className="button secondary">Draw a route</Link></div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-title"><h2>Check this place</h2><span className="muted">One-time browser location request</span></div>
        <label className="field"><span>Search radius: {radius} m</span><input aria-label="Nearby search radius" type="range" min="100" max="5000" step="100" value={radius} onChange={event => setRadius(Number(event.target.value))} /></label>
        <button className="button" onClick={checkLocation} disabled={loading}>{loading ? 'Checking…' : 'What’s relevant here?'}</button>
        {location && <p className="muted">Current check: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>}
        {error && <div className="error" role="alert">{error}</div>}{status && <div className="success" role="status">{status}</div>}
      </section>
      <section className="panel"><div className="panel-title"><h2>Remember something here</h2></div>
        <form onSubmit={saveReminder}>
          <label className="field"><span>Memory to resurface</span><select aria-label="Memory for place reminder" value={selectedMemory} onChange={event => setSelectedMemory(event.target.value)} disabled={!memories.length}><option value="">Choose a memory with a location</option>{memories.map(memory => <option value={memory.id} key={memory.id}>{memory.title}</option>)}</select></label>
          <label className="field"><span>Reminder</span><input className="input" aria-label="Place reminder title" value={reminderTitle} onChange={event => setReminderTitle(event.target.value)} required maxLength={240} placeholder="Check the book I borrowed" /></label>
          <button className="button secondary" disabled={!location || !selectedMemory || !reminderTitle.trim()}>Save reminder at this place</button>
        </form>
      </section>
    </div>
    <section className="panel" style={{ marginTop: 16 }}><div className="panel-title"><h2>Nearby results</h2><span className="muted">{results.length} found</span></div>
      {results.length ? results.map((item,index) => <article className="memory-row" key={`${item.kind}:${item.id}`}><span className="memory-pin">{item.kind === 'reminder' ? '↗' : index + 1}</span><div className="memory-row-main"><b>{item.title}</b><span>{item.location_label ?? 'Saved location'} · {Math.round(item.distance_m)} m · {item.kind === 'reminder' ? 'Place reminder' : new Date(item.occurred_at).toLocaleString()}</span>{item.content && <p>{item.content}</p>}</div></article>) : <div className="empty">Check your location to see nearby memories. If location is unavailable, use the <Link href="/memories">memory library</Link> or draw a route.</div>}
    </section>
  </>;
}
