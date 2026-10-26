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

export type DatabaseReadinessState = { postmasterStart: string; stableSince: number };

export function observeDatabaseReadiness(
  previous: DatabaseReadinessState | null,
  postmasterStart: string,
  now: number,
  requiredStabilityMs: number,
): { state: DatabaseReadinessState; ready: boolean } {
  if (!postmasterStart || !Number.isFinite(now) || !Number.isFinite(requiredStabilityMs) || requiredStabilityMs < 0) {
    throw new Error('database readiness observation is invalid');
  }
  if (!previous || previous.postmasterStart !== postmasterStart) {
    return { state: { postmasterStart, stableSince: now }, ready: false };
  }
  return { state: previous, ready: now - previous.stableSince >= requiredStabilityMs };
}
