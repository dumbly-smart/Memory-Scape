import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { summarizeMeasurements } from './benchmark-stats';

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
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      docker(['exec', container, 'pg_isready', '-U', 'memoryscape', '-d', 'memoryscape'], true);
      docker(['exec', container, 'psql', '-U', 'memoryscape', '-d', 'memoryscape', '-tAc', 'SELECT PostGIS_Full_Version()'], true);
      return;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  throw new Error(`Timed out waiting for disposable database ${container}`);
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
    const measurements: Array<{ trial: number; evaluation: Evaluation }> = [];
    for (let trial = 1; trial <= trials; trial += 1) {
      if (trial > 1) {
        docker(['restart', container], true);
        waitForDatabase(container);
        ({ databaseUrl, published } = currentDatabaseUrl());
        console.log(`PostgreSQL restarted for trial ${trial} on ${published}`);
      }
      const label = `buffer-${trial}`;
      runNpm(['run', 'db:benchmark'], databaseUrl, {
        BENCHMARK_RUNS: '1',
        BENCHMARK_LABEL: label,
        BENCHMARK_OUTPUT_DIR: temporaryOutputDirectory,
      });
      const file = path.join(temporaryOutputDirectory, `latest-${label}.json`);
      measurements.push({ trial, evaluation: JSON.parse(await readFile(file, 'utf8')) as Evaluation });
    }

    const names = Object.keys(measurements[0].evaluation.runs[0].plans);
    const plans = Object.fromEntries(names.map((name) => {
      const samples = measurements.map(({ evaluation }) => evaluation.runs[0].plans[name]);
      const stats = (read: (plan: Plan) => number | undefined) => summarizeMeasurements(
        samples.map(read).filter((value): value is number => value !== undefined),
      );
      return [name, {
        planningMs: stats((plan) => plan['Planning Time']),
        executionMs: stats((plan) => plan['Execution Time']),
        actualRows: stats((plan) => plan.Plan?.['Actual Rows']),
        sharedHitBlocks: stats((plan) => plan.Plan?.['Shared Hit Blocks']),
        sharedReadBlocks: stats((plan) => plan.Plan?.['Shared Read Blocks']),
      }];
    }));
    const result = {
      capturedAt: new Date().toISOString(),
      environment: measurements[0].evaluation.environment,
      parameters: { ...measurements[0].evaluation.parameters, freshBufferPoolTrials: trials },
      trials: measurements,
      summaries: {
        plans,
        fadingViewInitialCreationMs: summarizeMeasurements(measurements.map(({ evaluation }) => evaluation.runs[0].fadingViewInitialCreationMs)),
        fadingViewRefreshMs: summarizeMeasurements(measurements.map(({ evaluation }) => evaluation.runs[0].fadingViewRefreshMs)),
      },
      limitations: 'Each trial restarts an isolated PostgreSQL server, clearing shared_buffers. The operating-system file cache is not cleared, the host and dataset remain the same, and trials are sequential. These measurements are fresh PostgreSQL buffer-pool observations, not fully cold-disk or multi-hardware experiments.',
    };
    await writeFile(path.join(outputDirectory, 'fresh-buffer-pools.json'), JSON.stringify(result, null, 2));
    const rows = names.map((name) => {
      const summary = plans[name];
      return `| ${name} | ${summary.executionMs.median.toFixed(3)} | ${summary.executionMs.standardDeviation.toFixed(3)} | ${summary.sharedHitBlocks.median.toFixed(0)} | ${summary.sharedReadBlocks.median.toFixed(0)} |`;
    });
    const report = `# Fresh PostgreSQL buffer-pool trials\n\nCaptured ${result.capturedAt} across ${trials} sequential database restarts. Each trial has one benchmark repetition, followed by a full PostgreSQL restart before the next. The timing summary reports median and sample standard deviation across those restarts.\n\n## Environment\n\n- PostgreSQL: ${String(result.environment.postgres)}\n- PostGIS: ${String(result.environment.postgis)}\n- Memories: ${String((result.environment as Record<string, unknown>).memory_count)}\n- Trials: ${trials}\n- Parameters: 150 m route radius, recursion threshold 0.01, depths 1–3\n\n## Query measurements\n\n| Query | Execution median (ms) | Sample SD (ms) | Shared hits median | Shared reads median |\n|---|---:|---:|---:|---:|\n${rows.join('\n')}\n\n## Materialized view\n\n- Initial creation: ${result.summaries.fadingViewInitialCreationMs.median.toFixed(3)} ms median; ${result.summaries.fadingViewInitialCreationMs.standardDeviation.toFixed(3)} ms sample SD.\n- Refresh: ${result.summaries.fadingViewRefreshMs.median.toFixed(3)} ms median; ${result.summaries.fadingViewRefreshMs.standardDeviation.toFixed(3)} ms sample SD.\n\nThe script restarts only a disposable, separately named database container and removes that container and its temporary volume at completion. PostgreSQL shared buffers start empty at each trial. The operating-system file cache remains uncontrolled, so these are not cold-disk measurements. All trials use one host and run sequentially. Raw plans and individual measurements are in [fresh-buffer-pools.json](fresh-buffer-pools.json).\n`;
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
