import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_TILES, parseMapTileSettings } from '../lib/map-tiles';

describe('map tile source validation', () => {
  it('accepts local XYZ servers and preserves attribution', () => {
    expect(parseMapTileSettings({ url: 'http://localhost:8080/tiles/{z}/{x}/{y}.png', attribution: 'Local tiles' })).toEqual({ url: 'http://localhost:8080/tiles/{z}/{x}/{y}.png', attribution: 'Local tiles' });
  });
  it('rejects URLs without XYZ placeholders, non-HTTP protocols, credentials, and oversized values', () => {
    expect(parseMapTileSettings({ ...DEFAULT_MAP_TILES, url: 'https://tiles.example/0/0/0.png' })).toBeNull();
    expect(parseMapTileSettings({ ...DEFAULT_MAP_TILES, url: 'javascript:alert(1)/{z}/{x}/{y}' })).toBeNull();
    expect(parseMapTileSettings({ ...DEFAULT_MAP_TILES, url: 'https://user:secret@tiles.example/{z}/{x}/{y}' })).toBeNull();
    expect(parseMapTileSettings({ ...DEFAULT_MAP_TILES, attribution: 'x'.repeat(241) })).toBeNull();
  });
});
