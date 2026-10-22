import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pool } from '../lib/db/pool';
import { summarizeMeasurements } from './benchmark-stats';

type PlanNode = {
  'Node Type'?: string;
  'Actual Rows'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  Plans?: PlanNode[];
};
type ExplainPlan = { 'Planning Time'?: number; 'Execution Time'?: number; Plan?: PlanNode };
type BenchmarkRun = {
  run: number;
  plans: Record<string, ExplainPlan>;
  fadingViewInitialCreationMs: number;
  fadingViewRefreshMs: number;
};

function parseRunCount(value: string | undefined): number {
  const count = Number(value ?? '5');
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('BENCHMARK_RUNS must be an integer from 1 to 20');
  }
  return count;
}

async function main() {
  const runCount = parseRunCount(process.env.BENCHMARK_RUNS);
  const client = await pool.connect();
  try {
    const version = await client.query(`
      SELECT version() postgres, PostGIS_Full_Version() postgis,
        (SELECT count(*) FROM memories)::int memory_count,
        (SELECT count(*) FROM memory_edges)::int edge_count
    `);
    const seed = await client.query('SELECT id FROM memories ORDER BY id LIMIT 1');
    if (!seed.rowCount) throw new Error('Dataset is empty. Run npm run db:seed first.');

    const route = JSON.stringify({ type: 'LineString', coordinates: [[77.565, 13.018], [77.580, 13.030]] });
    const explain = async (sql: string, params: unknown[] = []) => {
      const response = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, params);
      return (response.rows[0]['QUERY PLAN'] as ExplainPlan[])[0];
    };
    const viewDefinition = await client.query("SELECT pg_get_viewdef('fading_memories_mv'::regclass, true) AS sql");

    const createViewInProbeSchema = async (run: number) => {
      const schema = `memoryscape_bench_${process.pid}_${run}`;
      await client.query('BEGIN');
      try {
        await client.query(`CREATE SCHEMA ${schema}`);
        const started = performance.now();
        await client.query(`CREATE MATERIALIZED VIEW ${schema}.fading_probe AS ${viewDefinition.rows[0].sql}`);
        const elapsed = performance.now() - started;
        await client.query(`DROP SCHEMA ${schema} CASCADE`);
        await client.query('COMMIT');
        return elapsed;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    };

    const runs: BenchmarkRun[] = [];
    for (let run = 1; run <= runCount; run++) {
      const plans: Record<string, ExplainPlan> = {};
      plans.spatial_index_candidate = await explain(
        'SELECT id FROM memories WHERE location IS NOT NULL AND ST_DWithin(location, ST_GeomFromGeoJSON($1)::geometry::geography, 150)',
        [route],
      );
      try {
        await client.query('SET enable_indexscan=off; SET enable_bitmapscan=off; SET enable_seqscan=on');
        plans.spatial_sequential_control = await explain(
          'SELECT id FROM memories WHERE location IS NOT NULL AND ST_DWithin(location, ST_GeomFromGeoJSON($1)::geometry::geography, 150)',
          [route],
        );
      } finally {
        await client.query('RESET enable_indexscan; RESET enable_bitmapscan; RESET enable_seqscan');
      }
      for (const depth of [1, 2, 3]) {
        plans[`associative_depth_${depth}`] = await explain(
          'SELECT * FROM associative_recall($1, $2, 0.01, 1)',
          [seed.rows[0].id, depth],
        );
      }
      plans.fading_view = await explain('SELECT * FROM fading_memories_mv ORDER BY review_priority DESC LIMIT 100');
      plans.fading_direct = await explain(`
        SELECT m.id, m.strength FROM memories m CROSS JOIN algorithm_parameters p
        WHERE m.strength < 0.65
        ORDER BY ((1-m.strength)*p.review_strength_weight
          + least(1,greatest(0,extract(epoch FROM(now()-m.last_strength_at))/(86400.0*p.review_age_cap_days)))
            * p.review_age_weight) DESC LIMIT 100
      `);
      const timeBounds = await client.query('SELECT max(occurred_at) latest FROM memories');
      const latest = new Date(timeBounds.rows[0].latest);
      plans.timeline = await explain(
        'SELECT id,title,occurred_at,strength FROM memories WHERE occurred_at >= $1 AND occurred_at < $2 ORDER BY occurred_at DESC LIMIT 100',
        [new Date(latest.getTime() - 30 * 86400000).toISOString(), new Date(latest.getTime() + 1).toISOString()],
      );

      const refreshStarted = performance.now();
      await client.query('REFRESH MATERIALIZED VIEW fading_memories_mv');
      const fadingViewRefreshMs = performance.now() - refreshStarted;
      const fadingViewInitialCreationMs = await createViewInProbeSchema(run);
      runs.push({ run, plans, fadingViewInitialCreationMs, fadingViewRefreshMs });
    }

    const planNames = Object.keys(runs[0].plans);
    const planSummaries = Object.fromEntries(planNames.map(name => {
      const plans = runs.map(item => item.plans[name]);
      const sample = (read: (plan: ExplainPlan) => number | undefined) =>
        summarizeMeasurements(plans.map(read).filter((value): value is number => value !== undefined));
      return [name, {
        planningMs: sample(plan => plan['Planning Time']),
        executionMs: sample(plan => plan['Execution Time']),
        actualRows: sample(plan => plan.Plan?.['Actual Rows']),
        sharedHitBlocks: sample(plan => plan.Plan?.['Shared Hit Blocks']),
        sharedReadBlocks: sample(plan => plan.Plan?.['Shared Read Blocks']),
      }];
    }));
    const initialCreation = summarizeMeasurements(runs.map(item => item.fadingViewInitialCreationMs));
    const refresh = summarizeMeasurements(runs.map(item => item.fadingViewRefreshMs));
    const result = {
      capturedAt: new Date().toISOString(),
      environment: {
        ...version.rows[0], platform: os.platform(), arch: os.arch(), cpus: os.cpus().length,
        totalMemoryBytes: os.totalmem(), node: process.version,
      },
      parameters: { radiusMeters: 150, recursionThreshold: 0.01, route, recursionDepths: [1, 2, 3], runCount },
      summaries: { plans: planSummaries },
      measurements: { fadingViewInitialCreationMs: initialCreation, fadingViewRefreshMs: refresh },
      plans: runs[0].plans,
      runs,
      limitations: 'Repeated measurements run sequentially in one database session and therefore share evolving cache state. Spatial scan comparison is planner-controlled, not an index drop. Results are machine and workload dependent; repeated runs do not establish cognitive validity.',
    };

    const directory = path.resolve('docs/evaluation');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'latest.json'), JSON.stringify(result, null, 2));
    const label = process.env.BENCHMARK_LABEL;
    const jsonName = label && /^[a-z0-9-]+$/i.test(label) ? `latest-${label}.json` : 'latest.json';
    const fmt = (summary: { median: number; mean: number; standardDeviation: number }) =>
      `${summary.median.toFixed(3)} ± ${summary.standardDeviation.toFixed(3)} ms`;
    const rows = planNames.map(name => {
      const summary = planSummaries[name];
      return `| ${name} | ${fmt(summary.planningMs)} | ${fmt(summary.executionMs)} | ${summary.executionMs.mean.toFixed(3)} | ${summary.actualRows.median.toFixed(0)} |`;
    });
    const report = `# Evaluation results\n\nCaptured ${result.capturedAt} over ${runCount} sequential runs. Values are median ± sample standard deviation; timing units are milliseconds.\n\n## Environment\n\n- PostgreSQL: ${version.rows[0].postgres}\n- PostGIS: ${version.rows[0].postgis}\n- Memories: ${version.rows[0].memory_count}; edges: ${version.rows[0].edge_count}\n- Host: ${os.platform()} ${os.arch()}, ${os.cpus().length} CPUs; Node ${process.version}\n- Parameters: 150 m route radius; recursive pruning threshold 0.01; ${runCount} repetitions per query.\n\n## Query plans\n\n| Query | Planning ms (median ± SD) | Execution ms (median ± SD) | Execution mean ms | Actual rows median |\n|---|---:|---:|---:|---:|\n${rows.join('\n')}\n\n## Materialized view\n\n- Initial creation: ${fmt(initialCreation)} (temporary generated schema dropped transactionally).\n- Refresh: ${fmt(refresh)}.\n\nEach repetition runs sequentially in one database session, so these are repeated observations with changing cache state, not independent cold-start samples. The spatial comparison disables index and bitmap scans at the session level without dropping production indexes. Full plans and per-run values are in [${jsonName}](${jsonName}). Results depend on dataset selectivity, planner choices, cache state, host load, and hardware.\n`;
    await writeFile(path.join(directory, 'RESULTS.md'), report);
    if (label && /^[a-z0-9-]+$/i.test(label)) {
      await writeFile(path.join(directory, `latest-${label}.json`), JSON.stringify(result, null, 2));
      await writeFile(path.join(directory, `RESULTS-${label}.md`), report);
    }
    console.log(`Evaluation captured ${runCount} repeated runs of ${planNames.length} plans. View creation median ${initialCreation.median.toFixed(3)} ms; refresh median ${refresh.median.toFixed(3)} ms.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('Evaluation failed:', error);
  process.exitCode = 1;
});
