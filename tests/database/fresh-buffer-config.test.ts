import { describe, expect, it } from 'vitest';
import { freshBufferCacheConfig, observeDatabaseReadiness, parseSpatialRadiusMeters, parseSpatialRadiusSweep, seedMemoryCount } from '../../scripts/fresh-buffer-config';

describe('fresh-buffer cache configuration', () => {
  it('supports explicit dataset sizes and the legacy large preset', () => {
    expect(seedMemoryCount([])).toBe(1200);
    expect(seedMemoryCount(['--large'])).toBe(10000);
    expect(seedMemoryCount(['--memories=50000'])).toBe(50000);
  });

  it('rejects malformed and conflicting dataset sizes', () => {
    expect(() => seedMemoryCount(['--memories=1.5'])).toThrow('--memories must be a positive integer');
    expect(() => seedMemoryCount(['--memories=1000001'])).toThrow('--memories must be between 1 and 1000000');
    expect(() => seedMemoryCount(['--large', '--memories=10000'])).toThrow('Use either --large or --memories=N, not both');
  });

  it('validates the configured benchmark route radius', () => {
    expect(parseSpatialRadiusMeters(undefined)).toBe(150);
    expect(parseSpatialRadiusMeters('25')).toBe(25);
    expect(() => parseSpatialRadiusMeters('0')).toThrow('between 1 and 50000');
    expect(() => parseSpatialRadiusMeters('NaN')).toThrow('between 1 and 50000');
    expect(() => parseSpatialRadiusMeters('50001')).toThrow('between 1 and 50000');
  });

  it('parses an ordered, unique route-radius sweep', () => {
    expect(parseSpatialRadiusSweep(undefined)).toEqual([150]);
    expect(parseSpatialRadiusSweep('25, 150,1000')).toEqual([25, 150, 1000]);
    expect(() => parseSpatialRadiusSweep('25,,100')).toThrow('1 to 8 comma-separated radii');
    expect(() => parseSpatialRadiusSweep('25,25')).toThrow('duplicate radii');
  });

  it('keeps the existing PostgreSQL restart-only benchmark as the default', () => {
    expect(freshBufferCacheConfig(undefined)).toEqual({
      evictPageCache: false,
      cacheStrategy: 'postgres_restart_only',
    });
  });

  it('labels the opt-in Linux page-cache eviction attempt explicitly', () => {
    expect(freshBufferCacheConfig('1')).toEqual({
      evictPageCache: true,
      cacheStrategy: 'relation_file_posix_fadvise_dontneed_attempt',
    });
  });

  it('waits for the same Postgres server start time to remain stable before readiness', () => {
    const first = observeDatabaseReadiness(null, 'server-start-a', 1000, 3000);
    expect(first).toEqual({ state: { postmasterStart: 'server-start-a', stableSince: 1000 }, ready: false });
    expect(observeDatabaseReadiness(first.state, 'server-start-a', 3500, 3000).ready).toBe(false);
    expect(observeDatabaseReadiness(first.state, 'server-start-a', 4000, 3000).ready).toBe(true);
  });

  it('resets its stability window when Postgres restarts during initialization', () => {
    const first = observeDatabaseReadiness(null, 'server-start-a', 1000, 3000);
    expect(observeDatabaseReadiness(first.state, 'server-start-b', 2500, 3000)).toEqual({
      state: { postmasterStart: 'server-start-b', stableSince: 2500 },
      ready: false,
    });
  });
});
