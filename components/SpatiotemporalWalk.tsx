'use client';

import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_MAP_TILES } from '@/lib/map-tiles';
import { CurrentLocationLayer } from '@/components/CurrentLocationLayer';

type Point = [latitude: number, longitude: number];
const defaultCenter: Point = [12.9698, 79.1559];

type RecallRow = {
  memory_id: string;
  title: string;
  coordinates: { type: 'Point'; coordinates: [number, number] } | null;
  distance_from_route: number;
  route_position: number;
  occurred_at: string;
  strength: number;
};

function localDateTime(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function RouteClickCapture({ onPoint }: { onPoint: (point: [number, number]) => void }) {
  useMapEvents({ click: event => onPoint([event.latlng.lat, event.latlng.lng]) });
  return null;
}

export function SpatiotemporalWalk() {
  const now = new Date();
  const [points, setPoints] = useState<Array<[number, number]>>([]);
  const [radius, setRadius] = useState(150);
  const [from, setFrom] = useState(localDateTime(new Date(now.getTime() - 30 * 86400_000)));
  const [until, setUntil] = useState(localDateTime(new Date(now.getTime() + 60_000)));
  const [rows, setRows] = useState<RecallRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Point | null>(null);
  const [locationStatus, setLocationStatus] = useState('Finding your current location…');
  const [locating, setLocating] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);

  const onCentered = useCallback(() => setLocationStatus('Centered on your current location'), []);
  const locateCurrentPosition = useCallback(() => {
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setLocationStatus('Location requires HTTPS or localhost. You can still draw a route manually.');
      return;
    }
    if (!navigator.geolocation) {
      setLocationStatus('Location is unavailable in this browser. You can still draw a route manually.');
      return;
    }
    setLocating(true);
    setLocationStatus('Finding your current location…');
    navigator.geolocation.getCurrentPosition(position => {
      setCurrentLocation([position.coords.latitude, position.coords.longitude]);
      setFocusRequest(value => value + 1);
      setLocationStatus('Location found; centering the map…');
      setLocating(false);
    }, cause => {
      setLocationStatus(cause.code === cause.PERMISSION_DENIED
        ? 'Location permission was declined. You can still draw a route manually.'
        : 'Could not determine your location. You can still draw a route manually.');
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 });
  }, []);

  useEffect(() => { locateCurrentPosition(); }, [locateCurrentPosition]);

  function beginRouteAtCurrentLocation() {
    if (!currentLocation) return;
    setPoints([currentLocation]);
    setRows([]);
    setError('');
  }

  async function search() {
    setError('');
    if (points.length < 2) { setError('Add at least two route points by clicking the map.'); return; }
    const fromDate = new Date(from);
    const untilDate = new Date(until);
    if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(untilDate.getTime()) || fromDate >= untilDate) {
      setError('Choose a valid event interval with its start before the exclusive end.');
      return;
    }
    setBusy(true);
    try {
      const route = { type: 'LineString', coordinates: points.map(([lat, lng]) => [lng, lat]) };
      const response = await fetch('/api/spatiotemporal/walk', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ route, radiusMeters: radius, from: fromDate.toISOString(), until: untilDate.toISOString() }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? 'Spatiotemporal recall failed');
      setRows(value.data as RecallRow[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Spatiotemporal recall failed');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="page-head">
      <div><div className="eyebrow">POSTGIS · GEOGRAPHY METERS · EVENT-TIME INTERSECTION</div><h1>Spatiotemporal recall</h1><p>Retrieve episodes close to a route and inside a selected event-time window. PostgreSQL applies both constraints and orders matches along the route.</p></div>
      <div className="toolbar"><button className="button secondary" disabled={!points.length} onClick={() => setPoints(value => value.slice(0, -1))}>Undo last point</button><button className="button secondary" onClick={() => { setPoints([]); setRows([]); }}>Clear route</button></div>
    </div>
    <div className="map-layout">
      <div className="map-panel"><MapContainer key={currentLocation ? 'current-location' : 'fallback-location'} center={currentLocation ?? defaultCenter} zoom={currentLocation ? 16 : 13} scrollWheelZoom>
        <TileLayer attribution={DEFAULT_MAP_TILES.attribution} url={DEFAULT_MAP_TILES.url}/>
        <CurrentLocationLayer position={currentLocation} request={focusRequest} onCentered={onCentered}/>
        <RouteClickCapture onPoint={point => setPoints(value => [...value, point])}/>
        {points.length > 1 && <Polyline positions={points} pathOptions={{ color: '#656dc2', weight: 5 }}/>}
        {points.map((point, index) => <Marker key={`route-${index}`} position={point}/>)}
        {rows.map(row => row.coordinates && <Marker key={row.memory_id} position={[row.coordinates.coordinates[1], row.coordinates.coordinates[0]]}/>)}
      </MapContainer>
      <div className="map-current-controls">
        <button className="map-locate-button" onClick={locateCurrentPosition} disabled={locating}>
          <span aria-hidden="true">⌖</span> {locating ? 'Finding you…' : 'My location'}
        </button>
      </div></div>
      <aside className="map-tools"><section className="panel">
        <div className="panel-title"><h2>Research query</h2><span className="muted">{points.length} route vertices</span></div>
        <p className="muted">Click the map to draw a LineString. The event window includes its start and excludes its end.</p>
        <div className="spatial-location-box" data-testid="spatiotemporal-location-status" role="status" aria-live="polite">
          <span className={`spatial-location-dot ${currentLocation ? 'is-found' : ''}`} />
          <span>{locationStatus}</span>
        </div>
        <div className="spatial-location-actions">
          <button className="button secondary" onClick={beginRouteAtCurrentLocation} disabled={!currentLocation || locating}>Start route at my location</button>
          <button className="button ghost" onClick={locateCurrentPosition} disabled={locating}>{locating ? 'Finding you…' : 'Recenter'}</button>
        </div>
        <div className="field"><label htmlFor="st-from">Event time from</label><input className="input" id="st-from" aria-label="Event time from" type="datetime-local" value={from} onChange={event => setFrom(event.target.value)}/></div>
        <div className="field"><label htmlFor="st-until">Event time until (exclusive)</label><input className="input" id="st-until" aria-label="Event time until (exclusive)" type="datetime-local" value={until} onChange={event => setUntil(event.target.value)}/></div>
        <div className="field"><label htmlFor="st-radius">Corridor radius · {radius} m</label><input id="st-radius" type="range" min="25" max="1000" step="25" value={radius} onChange={event => setRadius(Number(event.target.value))}/></div>
        <button className="button" style={{ width: '100%', justifyContent: 'center' }} disabled={busy} onClick={() => void search()}>{busy ? 'Searching…' : 'Run spatiotemporal recall'}</button>
        {error && <div className="error" role="alert">{error}</div>}
      </section>
      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panel-title"><h2>Ordered results</h2><span className="muted">{rows.length} found</span></div>
        <p className="muted">Route ordered · event interval {from.replace('T', ' ')} to {until.replace('T', ' ')} (exclusive)</p>
        <div style={{ maxHeight: 360, overflow: 'auto' }}>
          {rows.map((row, index) => <article className="result-card" key={row.memory_id}>
            <b>{String(index + 1).padStart(2, '0')} {row.title}</b>
            <span>{row.distance_from_route.toFixed(0)} m from route · {new Date(row.occurred_at).toLocaleString()} · {Math.round(row.strength * 100)}% strength</span>
          </article>)}
          {!rows.length && !busy && <div className="empty">Draw a route and choose an event window to run the combined recall query.</div>}
          {busy && <div className="empty" role="status">PostgreSQL is evaluating the spatial and temporal predicates…</div>}
        </div>
      </section></aside>
    </div>
  </>;
}
