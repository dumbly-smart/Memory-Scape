export const MAP_TILE_STORAGE_KEY = 'memoryscape.mapTiles.v1';
export const DEFAULT_MAP_TILES = { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap contributors' };
export type MapTileSettings = typeof DEFAULT_MAP_TILES;

export function parseMapTileSettings(value: unknown): MapTileSettings | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { url?: unknown; attribution?: unknown };
  if (typeof candidate.url !== 'string' || candidate.url.length > 500 || !candidate.url.includes('{z}') || !candidate.url.includes('{x}') || !candidate.url.includes('{y}')) return null;
  if (typeof candidate.attribution !== 'string' || candidate.attribution.length > 240) return null;
  try {
    const url = new URL(candidate.url.replaceAll('{s}', 'a').replaceAll('{z}', '0').replaceAll('{x}', '0').replaceAll('{y}', '0'));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return { url: candidate.url, attribution: candidate.attribution };
  } catch { return null; }
}
