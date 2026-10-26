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

export function seedMemoryCount(args: string[]): number {
  const countArgument = args.find((argument) => argument.startsWith('--memories='));
  if (args.includes('--large') && countArgument) {
    throw new Error('Use either --large or --memories=N, not both');
  }
  if (countArgument) {
    const value = countArgument.slice('--memories='.length);
    if (!/^\d+$/.test(value)) throw new Error('--memories must be a positive integer');
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 1 || count > 1_000_000) {
      throw new Error('--memories must be between 1 and 1000000');
    }
    return count;
  }
  return args.includes('--large') ? 10_000 : 1_200;
}

export function parseSpatialRadiusMeters(value: string | undefined): number {
  const radius = Number(value ?? '150');
  if (!Number.isFinite(radius) || radius < 1 || radius > 50_000) {
    throw new Error('BENCHMARK_RADIUS_METERS must be between 1 and 50000');
  }
  return radius;
}

export function parseSpatialRadiusSweep(value: string | undefined): number[] {
  if (!value) return [parseSpatialRadiusMeters(undefined)];
  const entries = value.split(',').map(entry => entry.trim());
  if (entries.length > 8 || entries.some(entry => !entry)) {
    throw new Error('BENCHMARK_SPATIAL_RADII_METERS must contain 1 to 8 comma-separated radii');
  }
  const radii = entries.map(parseSpatialRadiusMeters);
  if (new Set(radii).size !== radii.length) {
    throw new Error('BENCHMARK_SPATIAL_RADII_METERS must not contain duplicate radii');
  }
  return radii;
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
