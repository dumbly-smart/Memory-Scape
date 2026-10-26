import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { PoolClient } from 'pg';
import { pool } from '../lib/db/pool';
import { createResearchFixture, createSeededRandom, seededShuffle, type ResearchEdge, type ResearchFixture } from '../lib/research/fixture';
import { rankCalibrationCandidates, scoreRetrieval, summarizeMetricTrials, type MetricTrialSummary, type RetrievalMetrics } from '../lib/research/metrics';
import { summarizeMeasurements } from './benchmark-stats';

type Scenario = { name: string; metrics: RetrievalMetrics; candidateCount: number; topActivation: number | null; elapsedMs: ReturnType<typeof summarizeMeasurements> };
type EdgeRow = ResearchEdge & { id: string; src: string; dst: string };

function argument(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function repetitions(): number {
  const value = Number(process.env.RESEARCH_REPETITIONS ?? 5);
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error('RESEARCH_REPETITIONS must be an integer from 1 to 20');
  return value;
}

async function insertFixture(client: PoolClient, fixture: ResearchFixture): Promise<{ ids: Map<string, string>; edges: EdgeRow[] }> {
  const ids = new Map(fixture.memories.map(memory => [memory.label, randomUUID()]));
  for (const memory of fixture.memories) {
    await client.query(
      `INSERT INTO memories(id,title,content,occurred_at,location,strength,decay_rate,last_strength_at)
       VALUES($1,$2,'Synthetic, labeled research fixture',$3,ST_SetSRID(ST_MakePoint($4,$5),4326)::geography,$6,$7,'2025-01-01T14:00:00Z')`,
      [ids.get(memory.label), memory.title, memory.occurredAt, memory.longitude, memory.latitude, memory.strength, memory.decayRate ?? 0],
    );
  }
  const edges: EdgeRow[] = [];
  for (const edge of fixture.edges) {
    const result = await client.query<{ id: string }>(
      'INSERT INTO memory_edges(src,dst,edge_type,weight,valence) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [ids.get(edge.source), ids.get(edge.target), edge.type, edge.weight, edge.valence],
    );
    edges.push({ ...edge, id: result.rows[0].id, src: ids.get(edge.source)!, dst: ids.get(edge.target)! });
  }
  return { ids, edges };
}

function labels(ids: Map<string, string>): Map<string, string> {
  return new Map([...ids].map(([label, id]) => [id, label]));
}

async function runGraphScenario(
  client: PoolClient,
  name: string,
  ids: Map<string, string>,
  labelById: Map<string, string>,
  expected: string[],
  depth: number,
  threshold: number,
  runs: number,
): Promise<Scenario> {
  const times: number[] = [];
  let ranked: string[] = [];
  let topActivation: number | null = null;
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    const result = await client.query<{ memory_id: string; activation: number }>(
      'SELECT memory_id,activation FROM associative_recall($1::uuid,$2,$3,1)',
      [ids.get('seed'), depth, threshold],
    );
    times.push(performance.now() - started);
    ranked = result.rows.map(row => labelById.get(row.memory_id) ?? row.memory_id);
    topActivation = result.rows[0] ? Number(result.rows[0].activation) : null;
  }
  return { name, metrics: scoreRetrieval(expected, ranked), candidateCount: ranked.length, topActivation, elapsedMs: summarizeMeasurements(times) };
}

async function runSpatialScenario(
  client: PoolClient,
  fixture: ResearchFixture,
  ids: Map<string, string>,
  labelById: Map<string, string>,
  name: string,
  radius: number,
  runs: number,
): Promise<Scenario> {
  const times: number[] = [];
  let ranked: string[] = [];
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    const result = await client.query<{ memory_id: string }>(
      'SELECT memory_id FROM spatiotemporal_memory_walk($1::jsonb,$2,$3::timestamptz,$4::timestamptz)',
      [JSON.stringify(fixture.route), radius, fixture.from, fixture.until],
    );
    times.push(performance.now() - started);
    ranked = result.rows.map(row => labelById.get(row.memory_id) ?? row.memory_id);
  }
  return { name, metrics: scoreRetrieval(fixture.routeRelevant, ranked), candidateCount: ranked.length, topActivation: null, elapsedMs: summarizeMeasurements(times) };
}

async function resetMemoryStrengths(client: PoolClient, fixture: ResearchFixture, ids: Map<string, string>): Promise<void> {
  for (const memory of fixture.memories) {
    await client.query('UPDATE memories SET strength=$2,decay_rate=0,last_strength_at=$3 WHERE id=$1', [ids.get(memory.label), memory.strength, '2025-01-01T14:00:00Z']);
  }
}

async function applyFixtureDecay(client: PoolClient, ids: Map<string, string>, days: number, lambda: number): Promise<void> {
  const at = new Date(Date.parse('2025-01-01T14:00:00Z') + days * 86_400_000).toISOString();
  for (const id of ids.values()) {
    await client.query('UPDATE memories SET decay_rate=$2 WHERE id=$1', [id, lambda]);
    await client.query('SELECT apply_memory_decay($1::timestamptz,$2::uuid)', [at, id]);
  }
}

async function resetLocations(client: PoolClient, fixture: ResearchFixture, ids: Map<string, string>, missing: Set<string> = new Set(), noiseMeters = 0, seed = 497): Promise<void> {
  const random = createSeededRandom(seed);
  const values = fixture.memories.map(memory => {
    const id = ids.get(memory.label)!;
    if (missing.has(memory.label)) return { id, longitude: null, latitude: null };
    const angle = random() * 2 * Math.PI;
    const latitude = memory.latitude + Math.cos(angle) * noiseMeters / 111_320;
    const longitude = memory.longitude + Math.sin(angle) * noiseMeters / (111_320 * Math.cos(memory.latitude * Math.PI / 180));
    return { id, longitude, latitude };
  });
  await client.query(`
    UPDATE memories AS m SET location=CASE
      WHEN v.longitude IS NULL THEN NULL
      ELSE ST_SetSRID(ST_MakePoint(v.longitude,v.latitude),4326)::geography
    END
    FROM jsonb_to_recordset($1::jsonb) AS v(id uuid,longitude double precision,latitude double precision)
    WHERE m.id=v.id
  `, [JSON.stringify(values)]);
}

async function restoreEdges(client: PoolClient, edges: EdgeRow[], removed: EdgeRow[]): Promise<void> {
  if (!removed.length) return;
  await client.query('DELETE FROM memory_edges WHERE id=ANY($1::uuid[])', [edges.map(edge => edge.id)]);
  for (const edge of edges) {
    await client.query(
      'INSERT INTO memory_edges(id,src,dst,edge_type,weight,valence) VALUES($1,$2,$3,$4,$5,$6)',
      [edge.id, edge.src, edge.dst, edge.type, edge.weight, edge.valence],
    );
  }
}

async function main() {
  const seed = Number(argument('seed', '497'));
  const fixture = createResearchFixture(seed);
  const runCount = repetitions();
  const client = await pool.connect();
  const before = await client.query<{ memories: number; edges: number; contexts: number; parameters: unknown }>(
    `SELECT (SELECT count(*)::int FROM memories) memories,(SELECT count(*)::int FROM memory_edges) edges,
      (SELECT count(*)::int FROM contexts) contexts,
      (SELECT jsonb_build_object('valence_base',valence_base,'valence_salience',valence_salience,
        'review_strength_weight',review_strength_weight,'review_age_weight',review_age_weight,
        'review_age_cap_days',review_age_cap_days) FROM algorithm_parameters WHERE singleton) parameters`,
  );
  const results = { ablations: [] as Scenario[], calibration: [] as Array<Scenario & { valenceSalience: number; valenceBase: number; threshold: number }>, radiusSensitivity: [] as Scenario[], robustness: [] as Scenario[] };
  let environment: Record<string, unknown> = {};
  let ids = new Map<string, string>();
  let edgeRows: EdgeRow[] = [];
  let labelById = new Map<string, string>();

  await client.query('BEGIN');
  try {
    const info = await client.query(`SELECT version() postgres,PostGIS_Full_Version() postgis,
      (SELECT count(*)::int FROM memories) memory_count,(SELECT count(*)::int FROM memory_edges) edge_count,
      current_setting('server_version_num') server_version_num`);
    environment = { ...info.rows[0], platform: os.platform(), arch: os.arch(), cpus: os.cpus().length, totalMemoryBytes: os.totalmem(), node: process.version };
    const fixtureData = await insertFixture(client, fixture);
    ids = fixtureData.ids;
    edgeRows = fixtureData.edges;
    labelById = labels(ids);
    await client.query('SELECT valence_base,valence_salience FROM algorithm_parameters WHERE singleton FOR UPDATE');
    await client.query('UPDATE algorithm_parameters SET valence_base=0.75,valence_salience=0.25 WHERE singleton');

    const baselineGraph = await runGraphScenario(client, 'baseline', ids, labelById, fixture.graphRelevant, 3, 0.01, runCount);
    results.ablations.push(baselineGraph);
    await client.query('UPDATE memory_edges SET weight=1 WHERE id=ANY($1::uuid[])', [edgeRows.map(edge => edge.id)]);
    results.ablations.push(await runGraphScenario(client, 'edge_weight_disabled', ids, labelById, fixture.graphRelevant, 3, 0.01, runCount));
    await restoreEdges(client, edgeRows, edgeRows);

    await client.query('UPDATE memories SET strength=1 WHERE id=ANY($1::uuid[]) AND id<>$2::uuid', [fixture.memories.map(memory => ids.get(memory.label)), ids.get('seed')]);
    results.ablations.push(await runGraphScenario(client, 'target_strength_disabled', ids, labelById, fixture.graphRelevant, 3, 0.01, runCount));
    for (const memory of fixture.memories) await client.query('UPDATE memories SET strength=$2 WHERE id=$1', [ids.get(memory.label), memory.strength]);

    await client.query('UPDATE memory_edges SET valence=0 WHERE id=ANY($1::uuid[])', [edgeRows.map(edge => edge.id)]);
    results.ablations.push(await runGraphScenario(client, 'valence_salience_disabled', ids, labelById, fixture.graphRelevant, 3, 0.01, runCount));
    await restoreEdges(client, edgeRows, edgeRows);
    results.ablations.push(await runGraphScenario(client, 'one_hop_depth_ablation', ids, labelById, fixture.graphRelevant, 1, 0.01, runCount));
    for (const days of [1, 7, 30]) {
      await applyFixtureDecay(client, ids, days, 0.2);
      results.ablations.push(await runGraphScenario(client, `temporal_decay_${days}d_lambda_0.2`, ids, labelById, fixture.graphRelevant, 3, 0.01, runCount));
      await resetMemoryStrengths(client, fixture, ids);
    }
    for (const threshold of [0, 0.01, 0.05, 0.1, 0.2, 0.35]) {
      results.ablations.push(await runGraphScenario(client, `pruning_threshold_${threshold}`, ids, labelById, fixture.graphRelevant, 3, threshold, runCount));
    }

    const baselineEdges = edgeRows;
    for (const valenceSalience of [0, 0.25, 0.5, 0.75, 1]) {
      const valenceBase = 1 - valenceSalience;
      await client.query('UPDATE algorithm_parameters SET valence_base=$1,valence_salience=$2 WHERE singleton', [valenceBase, valenceSalience]);
      for (const threshold of [0.01, 0.05, 0.1, 0.2]) {
        const scenario = await runGraphScenario(client, `salience_${valenceSalience}_threshold_${threshold}`, ids, labelById, fixture.graphRelevant, 3, threshold, runCount);
        results.calibration.push({ ...scenario, valenceSalience, valenceBase, threshold });
      }
    }
    results.calibration = rankCalibrationCandidates(results.calibration);
    await client.query('UPDATE algorithm_parameters SET valence_base=0.75,valence_salience=0.25 WHERE singleton');

    for (const radius of [25, 50, 75, 150, 500, 1500]) {
      results.radiusSensitivity.push(await runSpatialScenario(client, fixture, ids, labelById, `corridor_radius_${radius}m`, radius, runCount));
    }
    for (const noiseMeters of [0, 5, 25, 75, 150, 300]) {
      await resetLocations(client, fixture, ids, new Set(), noiseMeters, seed + noiseMeters + 1);
      results.robustness.push(await runSpatialScenario(client, fixture, ids, labelById, `location_noise_${noiseMeters}m`, fixture.radiusMeters, runCount));
    }
    for (const fraction of [0.25, 0.5, 0.75]) {
      for (let trial = 0; trial < 5; trial += 1) {
        const shuffled = seededShuffle(edgeRows, seed + Math.round(fraction * 1000) + trial);
        const removeCount = Math.floor(edgeRows.length * fraction);
        const removed = shuffled.slice(0, removeCount);
        if (removed.length) await client.query('DELETE FROM memory_edges WHERE id=ANY($1::uuid[])', [removed.map(edge => edge.id)]);
        const scenario = await runGraphScenario(client, `edge_removal_${fraction}_trial_${trial + 1}`, ids, labelById, fixture.graphRelevant, 3, 0.01, runCount);
        results.robustness.push(scenario);
        await restoreEdges(client, edgeRows, removed);
      }
    }
    for (const missingFraction of [0.25, 0.5]) {
      const random = createSeededRandom(seed + Math.round(missingFraction * 10_000));
      const candidates = fixture.memories.filter(memory => memory.relevantToRoute);
      const missing = new Set(candidates.filter(() => random() < missingFraction).map(memory => memory.label));
      await resetLocations(client, fixture, ids, missing, 0, seed);
      results.robustness.push(await runSpatialScenario(client, fixture, ids, labelById, `missing_locations_${missingFraction}`, fixture.radiusMeters, runCount));
    }
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const after = await pool.query<{ memories: number; edges: number; contexts: number; parameters: unknown }>(
    `SELECT (SELECT count(*)::int FROM memories) memories,(SELECT count(*)::int FROM memory_edges) edges,
      (SELECT count(*)::int FROM contexts) contexts,
      (SELECT jsonb_build_object('valence_base',valence_base,'valence_salience',valence_salience,
        'review_strength_weight',review_strength_weight,'review_age_weight',review_age_weight,
        'review_age_cap_days',review_age_cap_days) FROM algorithm_parameters WHERE singleton) parameters`,
  );
  const fixtureCheck = await pool.query<{ memories: number; edges: number }>(
    'SELECT (SELECT count(*)::int FROM memories WHERE id=ANY($1::uuid[])) memories,(SELECT count(*)::int FROM memory_edges WHERE id=ANY($2::uuid[])) edges',
    [[...ids.values()], edgeRows.map(edge => edge.id)],
  );
  if (JSON.stringify(before.rows[0]) !== JSON.stringify(after.rows[0]) || fixtureCheck.rows[0].memories !== 0 || fixtureCheck.rows[0].edges !== 0) {
    throw new Error(`Research evaluation changed persistent row counts: before=${JSON.stringify(before.rows[0])}; after=${JSON.stringify(after.rows[0])}`);
  }
  const edgeRemovalSummary = [0.25, 0.5, 0.75].map(fraction => ({
    fraction,
    ...summarizeMetricTrials(results.robustness
      .filter(scenario => scenario.name.startsWith(`edge_removal_${fraction}_trial_`))
      .map(scenario => scenario.metrics)),
  }));
  const output = path.resolve(argument('out', 'docs/evaluation/research'));
  await mkdir(output, { recursive: true });
  const artifact = {
    capturedAt: new Date().toISOString(),
    fixture: { seed, memoryCount: fixture.memories.length, edgeCount: fixture.edges.length, route: fixture.route, radiusMeters: fixture.radiusMeters, from: fixture.from, untilExclusive: fixture.until, routeRelevant: fixture.routeRelevant, graphRelevant: fixture.graphRelevant },
    environment,
    repetitions: runCount,
    rowCountsBeforeAndAfter: { before: before.rows[0], after: after.rows[0] },
    ablations: results.ablations,
    calibration: results.calibration,
    radiusSensitivity: results.radiusSensitivity,
    robustness: results.robustness,
    edgeRemovalSummary,
    calibrationSelection: 'Highest synthetic-ground-truth F1, then reciprocal rank, then lower pruning threshold, then lower valence salience. Runtime is reported but does not influence the selected coefficients. This is a synthetic fixture result, not human or biological calibration.',
    timingLimitations: 'Elapsed time is client-observed PostgreSQL round-trip time for the query and result transfer. Scenarios run sequentially in one session with changing cache state; these values are local workload observations, not cold-cache or cross-machine claims.',
  };
  const markdown = renderReport(artifact);
  await writeFile(path.join(output, 'RESULTS.json'), `${JSON.stringify(artifact, null, 2)}\n`);
  await writeFile(path.join(output, 'RESULTS.md'), markdown);
  console.log(`Research evaluation complete: ${results.ablations.length} ablations, ${results.calibration.length} calibration settings, ${results.radiusSensitivity.length} radii, ${results.robustness.length} robustness runs.`);
  console.log(`Persistent row counts unchanged (${JSON.stringify(after.rows[0])}). Results: ${output}`);
}

function renderReport(value: {
  capturedAt: string;
  fixture: { seed: number; memoryCount: number; edgeCount: number; radiusMeters: number; from: string; untilExclusive: string; routeRelevant: string[]; graphRelevant: string[] };
  environment: Record<string, unknown>;
  repetitions: number;
  ablations: Scenario[];
  calibration: Array<Scenario & { valenceSalience: number; valenceBase: number; threshold: number }>;
  radiusSensitivity: Scenario[];
  robustness: Scenario[];
  edgeRemovalSummary: Array<{ fraction: number } & MetricTrialSummary>;
  calibrationSelection: string;
  timingLimitations: string;
}): string {
  const row = (scenario: Scenario) => `| ${scenario.name} | ${scenario.candidateCount} | ${scenario.metrics.precision.toFixed(3)} | ${scenario.metrics.recall.toFixed(3)} | ${scenario.metrics.f1.toFixed(3)} | ${scenario.metrics.reciprocalRank.toFixed(3)} | ${scenario.topActivation?.toFixed(5) ?? '—'} | ${scenario.elapsedMs.median.toFixed(3)} |`;
  const table = (scenarios: Scenario[]) => `| Scenario | Candidates | Precision | Recall | F1 | MRR | Top activation | Median round-trip ms |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${scenarios.map(row).join('\n')}`;
  const edgeTable = `| Edges removed | Trials | F1 mean ± sample SD | F1 range | MRR mean ± sample SD | MRR range |\n|---:|---:|---:|---:|---:|---:|\n${value.edgeRemovalSummary.map(item => `| ${(item.fraction * 100).toFixed(0)}% | ${item.count} | ${item.f1.mean.toFixed(3)} ± ${item.f1.sampleStandardDeviation.toFixed(3)} | ${item.f1.minimum.toFixed(3)}–${item.f1.maximum.toFixed(3)} | ${item.reciprocalRank.mean.toFixed(3)} ± ${item.reciprocalRank.sampleStandardDeviation.toFixed(3)} | ${item.reciprocalRank.minimum.toFixed(3)}–${item.reciprocalRank.maximum.toFixed(3)} |`).join('\n')}`;
  const best = value.calibration[0];
  return `# Synthetic research evaluation results\n\nCaptured ${value.capturedAt}. These are generated from the fixed labeled fixture, not participant observations.\n\n## Environment and protocol\n\n- PostgreSQL: ${String(value.environment.postgres)}\n- PostGIS: ${String(value.environment.postgis)}\n- Persistent workspace rows before/after: equal (see JSON for counts).\n- Host: ${String(value.environment.platform)} ${String(value.environment.arch)}, ${String(value.environment.cpus)} CPUs; Node ${String(value.environment.node)}\n- Fixture: seed ${value.fixture.seed}, ${value.fixture.memoryCount} memories, ${value.fixture.edgeCount} directed edges.\n- Spatiotemporal truth: ${value.fixture.routeRelevant.join(', ')} within ${value.fixture.radiusMeters} m and [${value.fixture.from}, ${value.fixture.untilExclusive}).\n- Associative truth: ${value.fixture.graphRelevant.join(', ')}.\n- Query repetitions: ${value.repetitions} per scenario. Metrics are precision, recall, F1, and mean reciprocal rank.\n\n## Ablation and pruning sensitivity\n\n${table(value.ablations)}\n\n## Synthetic parameter calibration\n\n${table(value.calibration)}\n\nSelected configuration: salience ${best?.valenceSalience ?? 'n/a'}, base ${best?.valenceBase ?? 'n/a'}, threshold ${best?.threshold ?? 'n/a'} under the selection rule: ${value.calibrationSelection}\n\n## Route radius sensitivity\n\n${table(value.radiusSensitivity)}\n\n## Robustness under location and graph corruption\n\n${table(value.robustness)}\n\n### Descriptive variability across seeded edge-removal trials\n\n${edgeTable}\n\nThese sample standard deviations and ranges describe only the five deterministic corruptions at each edge-removal fraction. They are not confidence intervals and do not estimate human, real-world, or population variability.\n\n## Interpretation limits\n\n${value.timingLimitations} The selected parameter setting optimizes this small synthetic fixture only. It is not evidence of biological constants, cognitive validity, or general retrieval quality. Run with multiple fixture seeds and other machines before making broader performance claims.\n`;
}

main().catch(error => {
  console.error('Research evaluation failed:', error);
  process.exitCode = 1;
}).finally(() => pool.end());
