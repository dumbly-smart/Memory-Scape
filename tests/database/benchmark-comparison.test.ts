import { describe, expect, it } from 'vitest';
import { compareBenchmarkArtifacts, type ComparisonArtifact } from '../../scripts/benchmark-comparison';

function artifact(machineLabel: string, medianMs: number, memoryCount = 1200): ComparisonArtifact {
  return {
    capturedAt: '2026-10-23T00:00:00.000Z',
    machineLabel,
    environment: { memory_count: memoryCount, postgres: 'PostgreSQL 16' },
    parameters: { cacheStrategy: 'relation_page_cache_eviction_attempt' },
    summaries: {
      plans: {
        spatial_index_candidate: {
          executionMs: { median: medianMs, mean: medianMs + 0.1, confidenceInterval95: { lower: medianMs - 1, upper: medianMs + 1 } },
        },
      },
    },
  };
}

describe('benchmark artifact comparison', () => {
  it('compares matching runs against the first machine baseline', () => {
    const rows = compareBenchmarkArtifacts([artifact('machine-a', 4), artifact('machine-b', 3)]);

    expect(rows).toEqual([{
      query: 'spatial_index_candidate',
      memoryCount: 1200,
      cacheStrategy: 'relation_page_cache_eviction_attempt',
      machines: [
        { label: 'machine-a', medianMs: 4, meanMs: 4.1, confidenceInterval95: { lower: 3, upper: 5 }, percentChangeVsBaseline: 0 },
        { label: 'machine-b', medianMs: 3, meanMs: 3.1, confidenceInterval95: { lower: 2, upper: 4 }, percentChangeVsBaseline: -25 },
      ],
    }]);
  });

  it('rejects comparisons with different dataset sizes', () => {
    expect(() => compareBenchmarkArtifacts([artifact('machine-a', 4), artifact('machine-b', 3, 10000)]))
      .toThrow('same memory count');
  });

  it('rejects comparisons with different cache strategies', () => {
    const other = artifact('machine-b', 3);
    other.parameters.cacheStrategy = 'shared_buffers_restart_only';
    expect(() => compareBenchmarkArtifacts([artifact('machine-a', 4), other]))
      .toThrow('same cache strategy');
  });
});
