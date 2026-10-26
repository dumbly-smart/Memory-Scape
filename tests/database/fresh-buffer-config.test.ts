import { describe, expect, it } from 'vitest';
import { freshBufferCacheConfig, observeDatabaseReadiness } from '../../scripts/fresh-buffer-config';

describe('fresh-buffer cache configuration', () => {
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
