'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { DEFAULT_MAP_TILES, MAP_TILE_STORAGE_KEY, parseMapTileSettings } from '@/lib/map-tiles';
import { CurrentLocationLayer } from '@/components/CurrentLocationLayer';

type Point = [latitude: number, longitude: number];
type Memory = {
  memory_id: string;
  title: string;
  coordinates: { coordinates: [number, number] } | null;
  distance_from_route: number;
  route_position: number;
  occurred_at: string;
  strength: number;
};
type MemoryDetail = {
  id: string;
  title: string;
  content: string;
  occurred_at: string;
  last_strength_at: string;
  strength: number;
  location_label: string | null;
  contexts: { id: string; type: string; label: string }[];
  associations: { id: string; memoryId: string; direction: string; type: string; title: string; weight: number; valence: number }[];
};

const memoryMarker = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border:3px solid white;border-radius:50%;background:#3c7557;box-shadow:0 1px 6px #20382b99"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
const defaultCenter: Point = [12.9698, 79.1559];

function RouteCorridor({ positions, radius }: { positions: Point[]; radius: number }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const latitude = (positions[0]?.[0] ?? 0) * Math.PI / 180;
  const metersPerPixel = 40_075_016.68557849 * Math.cos(latitude) / (256 * 2 ** zoom);
  return <Polyline positions={positions} pathOptions={{ color: '#83a88e', weight: Math.max(1, 2 * radius / metersPerPixel), opacity: 0.2, lineCap: 'round', lineJoin: 'round' }} interactive={false} />;
}

function ClickCapture({ add }: { add: (point: Point) => void }) {
  useMapEvents({ click: event => add([event.latlng.lat, event.latlng.lng]) });
  return null;
}

export function SpatialWalk() {
  const [points, setPoints] = useState<Point[]>([]);
  const [radius, setRadius] = useState(150);
  const [rows, setRows] = useState<Memory[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<MemoryDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [tileSettings, setTileSettings] = useState(DEFAULT_MAP_TILES);
  const [currentLocation, setCurrentLocation] = useState<Point | null>(null);
  const [locationStatus, setLocationStatus] = useState('Finding your current location…');
  const [locating, setLocating] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const coords = useMemo(() => points, [points]);

  const onCentered = useCallback(() => setLocationStatus('Centered on your current location'), []);

  const locateCurrentPosition = useCallback(() => {
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setLocationStatus('Location requires HTTPS or localhost. You can still explore the map manually.');
      return;
    }
    if (!navigator.geolocation) {
      setLocationStatus('Location is unavailable in this browser. You can still explore the map manually.');
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
      const message = cause.code === cause.PERMISSION_DENIED
        ? 'Location permission was declined. You can still pan the map or choose a place manually.'
        : 'Could not determine your location. You can still pan the map or choose a place manually.';
      setLocationStatus(message);
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 });
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MAP_TILE_STORAGE_KEY);
      if (saved) setTileSettings(parseMapTileSettings(JSON.parse(saved)) ?? DEFAULT_MAP_TILES);
    } catch {
      setTileSettings(DEFAULT_MAP_TILES);
    }
  }, []);

  useEffect(() => { locateCurrentPosition(); }, [locateCurrentPosition]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let active = true;
    fetch(`/api/memories/${selected}`).then(async response => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? 'Could not load selected memory');
      if (active) setDetail(value.data as MemoryDetail);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load selected memory');
    });
    return () => { active = false; };
  }, [selected]);

  const selectedIndex = rows.findIndex(memory => memory.memory_id === selected);

  async function search() {
    setError('');
    setNotice('');
    if (points.length < 2) {
      setError('Add at least two route points by clicking the map, or start at your location and add another point.');
      return;
    }
    setBusy(true);
    const route = { type: 'LineString', coordinates: points.map(([latitude, longitude]) => [longitude, latitude]) };
    try {
      const response = await fetch('/api/spatial/walk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ route, radiusMeters: radius }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? 'Spatial query failed');
      setRows(value.data as Memory[]);
      setSelected(value.data[0]?.memory_id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Spatial query failed');
    } finally {
      setBusy(false);
    }
  }

  function beginRouteAtCurrentLocation() {
    if (!currentLocation) return;
    setPoints([currentLocation]);
    setRows([]);
    setSelected(null);
    setError('');
    setNotice('Starting point added. Click the map to add at least one more point.');
  }

  function clearRoute() {
    setPoints([]);
    setRows([]);
    setSelected(null);
    setError('');
    setNotice('');
  }

  return <>
    <div className="page-head">
      <div>
        <div className="eyebrow">POSTGIS · GIST INDEX · LINEAR RECALL</div>
        <h1>Spatial memory walk</h1>
        <p>Start where you are, trace a route, and rediscover nearby memories in the order they happened.</p>
      </div>
      <div className="toolbar">
        <button className="button secondary" disabled={!points.length} onClick={() => setPoints(value => value.slice(0, -1))}>Undo last point</button>
        <button className="button secondary" onClick={clearRoute}>Clear route</button>
      </div>
    </div>

    <div className="map-layout spatial-walk-layout">
      <div className="map-panel spatial-map-panel">
        <MapContainer key={currentLocation ? 'current-location' : 'fallback-location'} center={currentLocation ?? defaultCenter} zoom={currentLocation ? 16 : 13} scrollWheelZoom>
          <TileLayer attribution={tileSettings.attribution} url={tileSettings.url} />
          <CurrentLocationLayer position={currentLocation} request={focusRequest} onCentered={onCentered} />
          <ClickCapture add={point => setPoints(value => [...value, point])} />
          {points.length > 1 && <>
            <RouteCorridor positions={coords} radius={radius} />
            <Polyline positions={coords} pathOptions={{ color: '#2f6c54', weight: 5, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }} />
          </>}
          {points.map((point, index) => <Marker key={`route-${index}`} position={point} />)}
          {rows.map(memory => memory.coordinates && <Marker
            key={memory.memory_id}
            position={[memory.coordinates.coordinates[1], memory.coordinates.coordinates[0]]}
            icon={memoryMarker}
            eventHandlers={{ click: () => setSelected(memory.memory_id) }}
          />)}
        </MapContainer>
        <div className="map-current-controls">
          <button className="map-locate-button" onClick={locateCurrentPosition} disabled={locating}>
            <span aria-hidden="true">⌖</span> {locating ? 'Finding you…' : 'My location'}
          </button>
        </div>
      </div>

      <aside className="map-tools spatial-walk-tools">
        <div className="panel-title"><h2>Route recall</h2><span className="muted">{points.length} {points.length === 1 ? 'vertex' : 'vertices'}</span></div>
        <p className="muted spatial-walk-intro">Begin at your current position or pan to a place. Click the map to add route points; results follow the path in event order.</p>
        <div className="spatial-location-box" data-testid="current-location-status" role="status" aria-live="polite">
          <span className={`spatial-location-dot ${currentLocation ? 'is-found' : ''}`} />
          <span>{locationStatus}</span>
        </div>
        <div className="spatial-location-actions">
          <button className="button secondary" onClick={beginRouteAtCurrentLocation} disabled={!currentLocation || locating}>Start route at my location</button>
          <button className="button ghost" onClick={locateCurrentPosition} disabled={locating}>Recenter</button>
        </div>
        <div className="field spatial-radius-field">
          <label htmlFor="route-radius">Corridor radius <b>{radius} m</b></label>
          <input id="route-radius" aria-label={`Corridor radius ${radius} meters`} type="range" min="25" max="1000" step="25" value={radius} onChange={event => setRadius(Number(event.target.value))} />
        </div>
        <button className="button spatial-run-button" disabled={busy || points.length < 2} onClick={() => void search()}>{busy ? 'Following route…' : 'Run spatial memory walk'}</button>
        {error && <div className="error" role="alert">{error}</div>}
        {notice && <div className="success spatial-route-notice" role="status">{notice}</div>}

        <div className="panel-title spatial-sequence-title"><div><span className="graph-detail-label">ORDERED BY ROUTE POSITION</span><h2>Route sequence</h2></div><span className="muted">{rows.length} found</span></div>
        {rows.length > 0 && <div className="toolbar spatial-sequence-controls">
          <button className="button ghost" disabled={selectedIndex <= 0} onClick={() => setSelected(rows[selectedIndex - 1]?.memory_id ?? null)}>← Previous</button>
          <button className="button ghost" disabled={selectedIndex < 0 || selectedIndex >= rows.length - 1} onClick={() => setSelected(rows[selectedIndex + 1]?.memory_id ?? null)}>Next →</button>
          {selectedIndex >= 0 && <span className="muted">{selectedIndex + 1} / {rows.length}</span>}
        </div>}

        <div className="spatial-results-list">
          {rows.map((memory, index) => <button
            key={memory.memory_id}
            className={`spatial-result ${selected === memory.memory_id ? 'is-selected' : ''}`}
            onClick={() => setSelected(memory.memory_id)}
            aria-current={selected === memory.memory_id ? 'true' : undefined}
          >
            <span className="spatial-result-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="spatial-result-copy"><b>{memory.title}</b><span>{memory.distance_from_route.toFixed(0)} m from route · {new Date(memory.occurred_at).toLocaleDateString()}</span></span>
          </button>)}
          {!rows.length && <div className="spatial-empty">Draw or start a route to reveal memories around it.</div>}
        </div>

        {selected && <section className="panel spatial-memory-detail" aria-label="Selected memory details">
          <div className="panel-title"><h3>{detail?.title ?? rows.find(memory => memory.memory_id === selected)?.title ?? 'Loading memory…'}</h3><span className="muted">{detail ? `${Math.round(Number(detail.strength) * 100)}% strength` : ''}</span></div>
          {detail && <>
            <p className="muted">Event: {new Date(detail.occurred_at).toLocaleString()} · {detail.location_label ?? 'No place label'}</p>
            <p>{detail.content || 'No additional notes.'}</p>
            <div className="muted">Contexts: {detail.contexts.map(context => context.label).join(' · ') || 'None'}</div>
            <div className="muted spatial-related">Related memories: {detail.associations.length ? detail.associations.map(association => <button className="button ghost" key={association.id} onClick={() => setSelected(association.memoryId)} title={`${association.type} · weight ${Number(association.weight).toFixed(2)} · valence ${Number(association.valence).toFixed(1)}`}>{association.direction === 'out' ? '→ ' : '← '}{association.title} · {association.type}</button>) : 'None yet'}</div>
          </>}
        </section>}
      </aside>
    </div>
  </>;
}
