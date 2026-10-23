export interface ComparisonArtifact {
  capturedAt: string;
  machineLabel: string;
  environment: {
    memory_count: number;
    postgres: string;
    platform?: string;
    arch?: string;
    cpus?: number;
    totalMemoryBytes?: number;
    node?: string;
    machineLabel?: string;
  };
  parameters: {
    cacheStrategy: string;
    radiusMeters?: number;
    recursionThreshold?: number;
  };
  summaries: {
    plans: Record<string, {
      executionMs: {
        median: number;
        mean: number;
        confidenceInterval95?: { lower: number; upper: number };
      };
    }>;
  };
}

export interface BenchmarkComparisonRow {
  query: string;
  memoryCount: number;
  cacheStrategy: string;
  machines: Array<{
    label: string;
    medianMs: number;
    meanMs: number;
    confidenceInterval95: { lower: number; upper: number } | null;
    percentChangeVsBaseline: number | null;
  }>;
}

function assertFinite(value: number, description: string): void {
  if (!Number.isFinite(value)) throw new Error(`${description} must be finite`);
}

export function compareBenchmarkArtifacts(artifacts: ComparisonArtifact[]): BenchmarkComparisonRow[] {
  if (artifacts.length < 2) throw new Error('Provide benchmark artifacts from at least two machines');
  const [baseline, ...comparisons] = artifacts;
  if (!baseline.machineLabel.trim()) throw new Error('Every artifact must have a machine label');
  const baselineQueries = Object.keys(baseline.summaries.plans).sort();
  if (!baselineQueries.length) throw new Error('Benchmark artifacts must include query plans');
  const labels = new Set<string>();
  for (const artifact of artifacts) {
    if (!artifact.machineLabel.trim() || labels.has(artifact.machineLabel)) {
      throw new Error('Machine labels must be nonempty and unique');
    }
    labels.add(artifact.machineLabel);
    if (artifact.environment.memory_count !== baseline.environment.memory_count) {
      throw new Error('Benchmark artifacts must use the same memory count');
    }
    if (artifact.parameters.cacheStrategy !== baseline.parameters.cacheStrategy) {
      throw new Error('Benchmark artifacts must use the same cache strategy');
    }
    if (artifact.parameters.radiusMeters !== baseline.parameters.radiusMeters
      || artifact.parameters.recursionThreshold !== baseline.parameters.recursionThreshold) {
      throw new Error('Benchmark artifacts must use matching route-radius and recursion-threshold parameters');
    }
    const queries = Object.keys(artifact.summaries.plans).sort();
    if (JSON.stringify(queries) !== JSON.stringify(baselineQueries)) {
      throw new Error('Benchmark artifacts must contain the same query plans');
    }
    for (const query of queries) {
      const execution = artifact.summaries.plans[query].executionMs;
      assertFinite(execution.median, `${artifact.machineLabel}/${query} median`);
      assertFinite(execution.mean, `${artifact.machineLabel}/${query} mean`);
      if (execution.confidenceInterval95) {
        assertFinite(execution.confidenceInterval95.lower, `${artifact.machineLabel}/${query} confidence lower bound`);
        assertFinite(execution.confidenceInterval95.upper, `${artifact.machineLabel}/${query} confidence upper bound`);
      }
    }
  }

  return baselineQueries.map((query) => {
    const baselineMedian = baseline.summaries.plans[query].executionMs.median;
    return {
      query,
      memoryCount: baseline.environment.memory_count,
      cacheStrategy: baseline.parameters.cacheStrategy,
      machines: artifacts.map((artifact) => {
        const execution = artifact.summaries.plans[query].executionMs;
        return {
          label: artifact.machineLabel,
          medianMs: execution.median,
          meanMs: execution.mean,
          confidenceInterval95: execution.confidenceInterval95 ?? null,
          percentChangeVsBaseline: baselineMedian === 0
            ? null
            : ((execution.median - baselineMedian) / baselineMedian) * 100,
        };
      }),
    };
  });
}

export function renderBenchmarkComparison(rows: BenchmarkComparisonRow[]): string {
  if (!rows.length) throw new Error('Cannot render an empty benchmark comparison');
  const labels = rows[0].machines.map((machine) => machine.label);
  const lines = [
    '# Cross-machine benchmark comparison',
    '',
    `Dataset: ${rows[0].memoryCount} memories. Cache strategy: ${rows[0].cacheStrategy}. Percent change uses ${labels[0]} as baseline; negative values indicate a lower median time.`,
    '',
    `| Query | ${labels.map((label) => `${label} median (ms)`).join(' | ')} |`,
    `|---|${labels.map(() => '---:').join('|')}|`,
    ...rows.map((row) => `| ${row.query} | ${row.machines.map((machine) => `${machine.medianMs.toFixed(3)} (${machine.percentChangeVsBaseline === null ? 'n/a' : `${machine.percentChangeVsBaseline.toFixed(1)}%`})`).join(' | ')} |`),
    '',
    'Values and confidence intervals are host-specific observations. The comparison does not treat machines as interchangeable or claim a causal hardware effect.',
    '',
  ];
  return lines.join('\n');
}
