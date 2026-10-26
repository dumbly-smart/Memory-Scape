import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { confidenceInterval95, summarizeMeasurements } from './benchmark-stats';
import { freshBufferCacheConfig, observeDatabaseReadiness } from './fresh-buffer-config';

type Plan = {
  'Planning Time'?: number;
  'Execution Time'?: number;
  Plan?: {
    'Actual Rows'?: number;
    'Shared Hit Blocks'?: number;
    'Shared Read Blocks'?: number;
  };
};
type Evaluation = {
  environment: Record<string, unknown>;
  parameters: Record<string, unknown>;
  runs: Array<{ plans: Record<string, Plan>; fadingViewInitialCreationMs: number; fadingViewRefreshMs: number }>;
};
type PageCacheEviction = {
  success: boolean;
  strategy: string;
  filesVisited: number;
  bytesTargeted: number;
  evictionRequests: number;
  guarantee: string;
};

function docker(args: string[], capture = false): string {
  return execFileSync('docker', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  }).trim();
}

function runNpm(args: string[], databaseUrl: string, extraEnv: Record<string, string | undefined> = {}) {
  execFileSync('npm', args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv, DATABASE_URL: databaseUrl },
  });
}

function waitForDatabase(container: string) {
  const deadline = Date.now() + 90_000;
  const stableDurationMs = 3_000;
  let readinessState: ReturnType<typeof observeDatabaseReadiness>['state'] | null = null;
  while (Date.now() < deadline) {
    try {
      const observation = docker([
        'exec', container, 'psql', '-U', 'memoryscape', '-d', 'memoryscape', '-tAc',
        "SELECT pg_postmaster_start_time()::text || '|' || PostGIS_Full_Version()",
      ], true);
      const delimiter = observation.indexOf('|');
      if (delimiter <= 0) throw new Error('PostgreSQL/PostGIS readiness query returned incomplete data');
      const postmasterStart = observation.slice(0, delimiter).trim();
      const postgisVersion = observation.slice(delimiter + 1).trim();
      if (!postmasterStart || !postgisVersion) throw new Error('PostgreSQL/PostGIS readiness query returned incomplete data');
      const result = observeDatabaseReadiness(readinessState, postmasterStart, Date.now(), stableDurationMs);
      readinessState = result.state;
      if (result.ready) return;
    } catch {
      readinessState = null;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error(`Timed out waiting for disposable database ${container} to finish PostgreSQL/PostGIS initialization`);
}

function evictRelationFilePages(container: string, volume: string, helperImage: string): PageCacheEviction {
  docker(['exec', container, 'psql', '-U', 'memoryscape', '-d', 'memoryscape', '-v', 'ON_ERROR_STOP=1', '-c', 'CHECKPOINT'], true);
  const scriptPath = path.resolve('scripts/evict-postgres-cache.py');
  const output = docker([
    'run', '--rm',
    '--volume', `${volume}:/var/lib/postgresql/data:ro`,
    '--volume', `${scriptPath}:/tmp/evict-postgres-cache.py:ro`,
    helperImage,
    'python3', '/tmp/evict-postgres-cache.py', '--data-directory', '/var/lib/postgresql/data',
  ], true);
  const report = JSON.parse(output) as PageCacheEviction;
  if (!report.success || report.strategy !== 'posix_fadvise_dontneed') {
    throw new Error(`PostgreSQL file-cache eviction request failed: ${output}`);
  }
  return report;
}

async function main() {
  const trials = Number(process.env.FRESH_BUFFER_TRIALS ?? '5');
  if (!Number.isInteger(trials) || trials < 2 || trials > 10) {
    throw new Error('FRESH_BUFFER_TRIALS must be an integer from 2 through 10');
  }

  const image = docker(['compose', 'images', '-q', 'db'], true);
  if (!image) throw new Error('Build the PostgreSQL service first with `docker compose build db`');

  const runId = `${process.pid}-${Date.now()}`;
  const container = `memoryscape-buffer-${runId}`;
  const volume = `memoryscape-buffer-data-${runId}`;
  const password = 'memoryscape_benchmark_only';
  const { evictPageCache, cacheStrategy } = freshBufferCacheConfig(process.env.FRESH_BUFFER_EVICT_PAGE_CACHE);
  const cacheEvictorImage = process.env.PAGE_CACHE_EVICTOR_IMAGE ?? 'python:3.12-alpine';
  const machineLabel = process.env.MACHINE_LABEL?.trim() || os.hostname();
  let created = false;
  let completed = false;
  let temporaryOutputDirectory: string | undefined;

  try {
    docker(['volume', 'create', volume], true);
    docker([
      'run', '-d', '--name', container, '--label', 'memoryscape.ephemeral-benchmark=true',
      '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_DB=memoryscape',
      '--env', 'POSTGRES_USER=memoryscape', '--env', `POSTGRES_PASSWORD=${password}`,
      '--volume', `${volume}:/var/lib/postgresql/data`, image,
      'postgres', '-c', 'shared_preload_libraries=pg_cron',
      '-c', 'cron.database_name=memoryscape', '-c', 'cron.timezone=UTC',
    ], true);
    created = true;
    function currentDatabaseUrl() {
      const published = docker(['port', container, '5432/tcp'], true);
      const port = Number(published.slice(published.lastIndexOf(':') + 1));
      if (!Number.isInteger(port) || port < 1) throw new Error(`Could not determine benchmark port from ${published}`);
      return { databaseUrl: `postgres://memoryscape:${password}@127.0.0.1:${port}/memoryscape`, published };
    }
    let { databaseUrl, published } = currentDatabaseUrl();
    console.log(`Disposable benchmark database is listening on ${published}`);
    waitForDatabase(container);
    runNpm(['run', 'db:migrate'], databaseUrl);
    runNpm(['run', 'db:seed', ...(process.argv.includes('--large') ? ['--', '--large'] : [])], databaseUrl);

    const outputDirectory = path.resolve('docs/evaluation/fresh-buffer-trials');
    await mkdir(outputDirectory, { recursive: true });
    temporaryOutputDirectory = await mkdtemp(path.join(os.tmpdir(), 'memoryscape-buffer-trials-'));
    const measurements: Array<{ trial: number; cacheEviction: PageCacheEviction | null; evaluation: Evaluation }> = [];
    for (let trial = 1; trial <= trials; trial += 1) {
      if (trial > 1) {
        docker(['restart', container], true);
        waitForDatabase(container);
        ({ databaseUrl, published } = currentDatabaseUrl());
        console.log(`PostgreSQL restarted for trial ${trial} on ${published}`);
      }
      const cacheEviction = evictPageCache
        ? evictRelationFilePages(container, volume, cacheEvictorImage)
        : null;
      if (cacheEviction) {
        console.log(`Trial ${trial}: requested eviction for ${cacheEviction.filesVisited} files (${cacheEviction.bytesTargeted} bytes).`);
      }
      const label = `buffer-${trial}`;
      runNpm(['run', 'db:benchmark'], databaseUrl, {
        BENCHMARK_RUNS: '1',
        BENCHMARK_LABEL: label,
        BENCHMARK_OUTPUT_DIR: temporaryOutputDirectory,
      });
      const file = path.join(temporaryOutputDirectory, `latest-${label}.json`);
      measurements.push({ trial, cacheEviction, evaluation: JSON.parse(await readFile(file, 'utf8')) as Evaluation });
    }

    const names = Object.keys(measurements[0].evaluation.runs[0].plans);
    const plans = Object.fromEntries(names.map((name) => {
      const samples = measurements.map(({ evaluation }) => evaluation.runs[0].plans[name]);
      const stats = (read: (plan: Plan) => number | undefined) => summarizeMeasurements(
        samples.map(read).filter((value): value is number => value !== undefined),
      );
      const executionTimes = samples.map((plan) => plan['Execution Time']).filter((value): value is number => value !== undefined);
      return [name, {
        planningMs: stats((plan) => plan['Planning Time']),
        executionMs: {
          ...summarizeMeasurements(executionTimes),
          confidenceInterval95: confidenceInterval95(executionTimes),
        },
        actualRows: stats((plan) => plan.Plan?.['Actual Rows']),
        sharedHitBlocks: stats((plan) => plan.Plan?.['Shared Hit Blocks']),
        sharedReadBlocks: stats((plan) => plan.Plan?.['Shared Read Blocks']),
      }];
    }));
    const result = {
      capturedAt: new Date().toISOString(),
      machineLabel,
      environment: { ...measurements[0].evaluation.environment, machineLabel },
      parameters: {
        ...measurements[0].evaluation.parameters,
        freshBufferPoolTrials: trials,
        cacheStrategy,
      },
      trials: measurements,
      summaries: {
        plans,
        fadingViewInitialCreationMs: {
          ...summarizeMeasurements(measurements.map(({ evaluation }) => evaluation.runs[0].fadingViewInitialCreationMs)),
          confidenceInterval95: confidenceInterval95(measurements.map(({ evaluation }) => evaluation.runs[0].fadingViewInitialCreationMs)),
        },
        fadingViewRefreshMs: {
          ...summarizeMeasurements(measurements.map(({ evaluation }) => evaluation.runs[0].fadingViewRefreshMs)),
          confidenceInterval95: confidenceInterval95(measurements.map(({ evaluation }) => evaluation.runs[0].fadingViewRefreshMs)),
        },
      },
      limitations: `Intervals are nominal two-sided 95% Student t intervals for the mean of fresh-buffer restart observations. They assume independent, approximately normal samples and do not model host, operating-system cache, or hardware variability. Each trial restarts an isolated PostgreSQL server, clearing shared_buffers. Cache strategy ${cacheStrategy} does not establish a cold disk or a verified fully cold operating-system cache; POSIX_FADV_DONTNEED is advisory.`,
    };
    await writeFile(path.join(outputDirectory, 'fresh-buffer-pools.json'), JSON.stringify(result, null, 2));
    const rows = names.map((name) => {
      const summary = plans[name];
      const interval = summary.executionMs.confidenceInterval95;
      return `| ${name} | ${summary.executionMs.median.toFixed(3)} | ${summary.executionMs.mean.toFixed(3)} [${interval.lower.toFixed(3)}, ${interval.upper.toFixed(3)}] | ${summary.executionMs.standardDeviation.toFixed(3)} | ${summary.sharedHitBlocks.median.toFixed(0)} | ${summary.sharedReadBlocks.median.toFixed(0)} |`;
    });
    const evictionRows = evictPageCache
      ? measurements.map(({ trial, cacheEviction }) => `| ${trial} | ${cacheEviction?.filesVisited ?? 0} | ${cacheEviction?.bytesTargeted ?? 0} |`).join('\n')
      : 'Disabled. PostgreSQL shared buffers were reset by restarting the isolated server; operating-system cache was uncontrolled.';
    const evictionSection = evictPageCache
      ? `| Trial | Relation files targeted | Bytes targeted |\n|---:|---:|---:|\n${evictionRows}\n\nThe helper checkpoints the disposable database and issues Linux POSIX_FADV_DONTNEED requests for regular files under PostgreSQL base/ and global/ directories. This is an advisory eviction request. The kernel may retain pages, PostgreSQL startup may warm pages, and no global cache flush is performed; interpret this as a cache-eviction attempt, not a cold-disk measurement.`
      : evictionRows;
    const environment = result.environment as Record<string, unknown>;
    const report = `# Fresh PostgreSQL buffer-pool trials\n\nCaptured ${result.capturedAt} across ${trials} sequential database restarts. Each trial has one benchmark repetition, followed by a full PostgreSQL restart before the next. The report includes median, sample standard deviation, and a nominal two-sided 95% Student t interval for the mean.\n\n## Environment\n\n- Machine: ${machineLabel}\n- PostgreSQL: ${String(environment.postgres)}\n- PostGIS: ${String(environment.postgis)}\n- Memories: ${String(environment.memory_count)}\n- Trials: ${trials}\n- Cache strategy: ${cacheStrategy}\n- Parameters: 150 m route radius, recursion threshold 0.01, depths 1–3\n\n## Query measurements\n\n| Query | Execution median (ms) | Mean (95% t interval, ms) | Sample SD (ms) | Shared hits median | Shared reads median |\n|---|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\n## Materialized view\n\n- Initial creation: ${result.summaries.fadingViewInitialCreationMs.median.toFixed(3)} ms median; mean ${result.summaries.fadingViewInitialCreationMs.mean.toFixed(3)} ms; 95% t interval [${result.summaries.fadingViewInitialCreationMs.confidenceInterval95.lower.toFixed(3)}, ${result.summaries.fadingViewInitialCreationMs.confidenceInterval95.upper.toFixed(3)}] ms; sample SD ${result.summaries.fadingViewInitialCreationMs.standardDeviation.toFixed(3)} ms.\n- Refresh: ${result.summaries.fadingViewRefreshMs.median.toFixed(3)} ms median; mean ${result.summaries.fadingViewRefreshMs.mean.toFixed(3)} ms; 95% t interval [${result.summaries.fadingViewRefreshMs.confidenceInterval95.lower.toFixed(3)}, ${result.summaries.fadingViewRefreshMs.confidenceInterval95.upper.toFixed(3)}] ms; sample SD ${result.summaries.fadingViewRefreshMs.standardDeviation.toFixed(3)} ms.\n\n## Operating-system page-cache handling\n\n${evictionSection}\n\nIntervals are conditional on this host and experiment. They assume independent, approximately normal restart samples and do not account for sequential ordering, host load, or hardware variation. The raw trial plans and cache-eviction request results are in [fresh-buffer-pools.json](fresh-buffer-pools.json).\n`;
    await writeFile(path.join(outputDirectory, 'RESULTS.md'), report);
    console.log(`Captured ${trials} fresh PostgreSQL buffer-pool trials in ${outputDirectory}`);
    completed = true;
  } finally {
    if (created) {
      if (!completed) {
        try { console.error(docker(['logs', container], true)); } catch { /* container may already be gone */ }
      }
      try { docker(['rm', '-f', container], true); } catch { /* already removed */ }
    }
    try { docker(['volume', 'rm', volume], true); } catch { /* volume was not created */ }
    if (temporaryOutputDirectory) await rm(temporaryOutputDirectory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error('Fresh-buffer evaluation failed:', error);
  process.exitCode = 1;
});
