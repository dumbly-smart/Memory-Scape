import { describe, expect, it } from 'vitest';
import { freshBufferCacheConfig } from '../../scripts/fresh-buffer-config';

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
});
