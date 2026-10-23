'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DEFAULT_MAP_TILES, MAP_TILE_STORAGE_KEY, MapTileSettings, parseMapTileSettings } from '@/lib/map-tiles';

export function MapTileSettingsPanel() {
  const [settings, setSettings] = useState<MapTileSettings>(DEFAULT_MAP_TILES);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    try { const stored = localStorage.getItem(MAP_TILE_STORAGE_KEY); if (stored) setSettings(parseMapTileSettings(JSON.parse(stored)) ?? DEFAULT_MAP_TILES); }
    catch { setSettings(DEFAULT_MAP_TILES); }
  }, []);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setStatus('');
    const form = new FormData(event.currentTarget);
    const value = parseMapTileSettings({ url: form.get('url'), attribution: form.get('attribution') });
    if (!value) { setError('Enter an HTTP(S) tile template with {z}, {x}, and {y} placeholders.'); return; }
    localStorage.setItem(MAP_TILE_STORAGE_KEY, JSON.stringify(value)); setSettings(value); setStatus('Saved for this browser. Reopen the map to use this tile source.');
  }
  function reset() { localStorage.removeItem(MAP_TILE_STORAGE_KEY); setSettings(DEFAULT_MAP_TILES); setStatus('Restored the OpenStreetMap default.'); setError(''); }
  return <section className="panel"><h2>Map tile source</h2><p className="muted">Use OpenStreetMap by default or point Leaflet at a local/offline-compatible XYZ tile server. This setting stays in this browser; memory data remains in PostgreSQL.</p>
    <form key={settings.url} onSubmit={save}><div className="field"><label htmlFor="map-tile-url">XYZ tile URL template</label><input id="map-tile-url" name="url" className="input" maxLength={500} defaultValue={settings.url} required /></div>
      <div className="field"><label htmlFor="map-tile-attribution">Attribution</label><input id="map-tile-attribution" name="attribution" className="input" maxLength={240} defaultValue={settings.attribution} /></div>
      {error && <div role="alert" className="error">{error}</div>}{status && <div role="status" className="success">{status}</div>}
      <div className="toolbar"><button className="button" type="submit">Save tile source</button><button className="button secondary" type="button" onClick={reset}>Use default</button></div>
    </form><p className="muted">Template example: <code>http://localhost:8080/&#123;z&#125;/&#123;x&#125;/&#123;y&#125;.png</code></p>
  </section>;
}
