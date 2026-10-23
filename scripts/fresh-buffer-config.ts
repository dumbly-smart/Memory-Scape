export function freshBufferCacheConfig(value: string | undefined): {
  evictPageCache: boolean;
  cacheStrategy: string;
} {
  const evictPageCache = value === '1';
  return {
    evictPageCache,
    cacheStrategy: evictPageCache
      ? 'relation_file_posix_fadvise_dontneed_attempt'
      : 'postgres_restart_only',
  };
}
