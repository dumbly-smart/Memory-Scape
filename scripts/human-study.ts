import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { confidenceInterval95 } from './benchmark-stats';

export type RecallCondition = 'conventional' | 'spatial' | 'associative';
const CONDITIONS: RecallCondition[] = ['conventional', 'spatial', 'associative'];
const REQUIRED_COLUMNS = [
  'participant_code', 'scenario_version', 'task_id', 'condition', 'order_index',
  'submitted_memory_id', 'found_target', 'elapsed_seconds', 'confidence_1_to_7',
  'workload_1_to_7', 'technical_issue',
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConditionScore {
  condition: RecallCondition;
  n: number;
  correct: number;
  accuracy: number | null;
  foundTargetRate: number | null;
  meanCorrectSeconds: number | null;
  meanConfidence: number | null;
  meanWorkload: number | null;
  technicalIssueCount: number;
}

export interface StudyScore {
  scenarioVersion: string;
  taskCount: number;
  responseCount: number;
  participantCount: number;
  completeParticipantCount: number;
  conditions: ConditionScore[];
  pairedAccuracy: {
    n: number;
    spatialMinusConventional: number | null;
    spatialMinusConventionalCi95: { lower: number; upper: number } | null;
    associativeMinusConventional: number | null;
    associativeMinusConventionalCi95: { lower: number; upper: number } | null;
  };
}

interface ScoredResponse {
  participant: string;
  condition: RecallCondition;
  correct: boolean;
  found: boolean;
  elapsed: number;
  confidence: number;
  workload: number;
  technicalIssue: boolean;
}

type Row = Record<string, string>;
type Json = Record<string, unknown>;

function object(value: unknown, label: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Json;
}

function nonempty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a nonempty string`);
  return value;
}

function finite(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be a finite number from ${min} to ${max}`);
  }
  return value;
}

function isCondition(value: string): value is RecallCondition {
  return CONDITIONS.includes(value as RecallCondition);
}

function isoDate(value: unknown, label: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) throw new Error(`${label} must be an ISO timestamp`);
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`${label} must be a valid ISO timestamp`);
  return time;
}

export function validateStudyMaterials(stimuliValue: unknown, answerKeyValue: unknown): void {
  const stimuli = object(stimuliValue, 'Stimuli');
  const answerKey = object(answerKeyValue, 'Answer key');
  const version = nonempty(stimuli.version, 'Stimuli version');
  if (answerKey.version !== version) throw new Error('Stimuli and answer key version must match');
  finite(stimuli.time_limit_seconds, 'Time limit', 1, 3600);

  const conditions = stimuli.conditions;
  if (!Array.isArray(conditions) || conditions.length !== 3 || CONDITIONS.some(condition => !conditions.includes(condition))) {
    throw new Error('Stimuli must define conventional, spatial, and associative conditions');
  }

  const tasks = stimuli.tasks;
  if (!Array.isArray(tasks) || tasks.length !== 3) throw new Error('Stimuli must contain exactly three equivalent scenario tasks');
  const taskIds = new Set<string>();
  const sets = new Set<string>();
  for (const rawTask of tasks) {
    const task = object(rawTask, 'Task');
    const id = nonempty(task.task_id, 'Task ID');
    if (taskIds.has(id)) throw new Error(`Duplicate task ID: ${id}`);
    taskIds.add(id);
    const scenarioSet = nonempty(task.scenario_set, `Scenario set for ${id}`);
    if (!['A', 'B', 'C'].includes(scenarioSet) || sets.has(scenarioSet)) throw new Error(`Scenario set ${scenarioSet} is invalid or duplicated`);
    sets.add(scenarioSet);
    nonempty(task.prompt, `Prompt for ${id}`);
    const taskConditions = object(task.conditions, `Conditions for ${id}`);

    const conventional = object(taskConditions.conventional, `Conventional parameters for ${id}`);
    nonempty(conventional.search_text, `Conventional search for ${id}`);
    const from = isoDate(conventional.from, `Conventional from for ${id}`);
    const to = isoDate(conventional.to, `Conventional to for ${id}`);
    if (from > to) throw new Error(`Conventional date range is reversed for ${id}`);

    const spatial = object(taskConditions.spatial, `Spatial parameters for ${id}`);
    finite(spatial.radius_meters, `Spatial radius for ${id}`, Number.EPSILON, 100_000);
    const route = object(spatial.route, `Spatial route for ${id}`);
    if (route.type !== 'LineString' || !Array.isArray(route.coordinates) || route.coordinates.length < 2) {
      throw new Error(`Spatial route for ${id} must be a LineString with at least two points`);
    }
    let hasDistinctPoint = false;
    let firstCoordinate: number[] | undefined;
    for (const coordinate of route.coordinates) {
      if (!Array.isArray(coordinate) || coordinate.length < 2) throw new Error(`Spatial route for ${id} contains an invalid coordinate`);
      finite(coordinate[0], `Route longitude for ${id}`, -180, 180);
      finite(coordinate[1], `Route latitude for ${id}`, -90, 90);
      if (!firstCoordinate) firstCoordinate = coordinate as number[];
      else if (coordinate[0] !== firstCoordinate[0] || coordinate[1] !== firstCoordinate[1]) hasDistinctPoint = true;
    }
    if (!hasDistinctPoint) throw new Error(`Spatial route for ${id} is degenerate`);

    const associative = object(taskConditions.associative, `Associative parameters for ${id}`);
    if (typeof associative.seed_memory_id !== 'string' || !UUID.test(associative.seed_memory_id)) {
      throw new Error(`Associative seed for ${id} must be a UUID`);
    }
    finite(associative.depth, `Associative depth for ${id}`, 1, 3);
    if (!Number.isInteger(associative.depth)) throw new Error(`Associative depth for ${id} must be an integer`);
    finite(associative.threshold, `Associative threshold for ${id}`, 0, 1);
  }

  const answerIds = object(answerKey.answers, 'Answer map');
  const answers = Object.keys(answerIds);
  if (answers.length !== taskIds.size || answers.some(id => !taskIds.has(id))) {
    throw new Error('Answer key must contain exactly one answer for each task');
  }
  for (const taskId of taskIds) {
    const answer = answerIds[taskId];
    if (typeof answer !== 'string' || !UUID.test(answer)) throw new Error(`Answer for ${taskId} must be a UUID`);
  }

  const counterbalance = stimuli.counterbalance;
  if (!Array.isArray(counterbalance) || counterbalance.length !== 3) throw new Error('Counterbalance must define three Latin-square orders');
  const seenOrders = new Set<number>();
  const seenAssignments = new Set<string>();
  const conditionAtPosition = new Map<number, Set<string>>();
  for (const rawOrder of counterbalance) {
    const order = object(rawOrder, 'Counterbalance order');
    const orderNumber = finite(order.order, 'Counterbalance order number', 1, 3);
    if (!Number.isInteger(orderNumber) || seenOrders.has(orderNumber)) throw new Error('Counterbalance order numbers must be unique integers 1 through 3');
    seenOrders.add(orderNumber);
    const assignment = object(order.condition_to_set, `Condition assignment ${orderNumber}`);
    const assignedSets = new Set<string>();
    for (const condition of CONDITIONS) {
      const set = nonempty(assignment[condition], `${condition} scenario assignment`);
      if (!sets.has(set) || assignedSets.has(set)) throw new Error(`Counterbalance order ${orderNumber} must assign each scenario set once`);
      assignedSets.add(set);
      seenAssignments.add(`${condition}:${set}`);
    }
    if (!Array.isArray(order.sequence) || order.sequence.length !== 3) throw new Error(`Counterbalance order ${orderNumber} must define three ordered trials`);
    const sequenceConditions = new Set<string>();
    const sequenceSets = new Set<string>();
    order.sequence.forEach((rawTrial, index) => {
      const trial = object(rawTrial, `Ordered trial ${index + 1} in schedule ${orderNumber}`);
      const condition = nonempty(trial.condition, `Condition in schedule ${orderNumber}`);
      const set = nonempty(trial.scenario_set, `Scenario set in schedule ${orderNumber}`);
      if (!isCondition(condition) || sequenceConditions.has(condition) || !sets.has(set) || sequenceSets.has(set)) {
        throw new Error(`Counterbalance sequence ${orderNumber} must use each condition and scenario set once`);
      }
      if (assignment[condition] !== set) throw new Error(`Counterbalance sequence ${orderNumber} conflicts with its condition assignment`);
      sequenceConditions.add(condition);
      sequenceSets.add(set);
      const positions = conditionAtPosition.get(index + 1) ?? new Set<string>();
      positions.add(condition);
      conditionAtPosition.set(index + 1, positions);
    });
  }
  if (seenOrders.size !== 3 || seenAssignments.size !== 9) throw new Error('Counterbalance must distribute all scenario sets across all conditions');
  if ([1, 2, 3].some(position => conditionAtPosition.get(position)?.size !== 3)) {
    throw new Error('Condition order must be balanced across the three Latin-square schedules');
  }
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else field += char;
      continue;
    }
    if (char === '"') {
      if (field !== '' || closedQuote) throw new Error('CSV has an unexpected quote');
      quoted = true;
    } else if (char === ',') {
      row.push(field); field = ''; closedQuote = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some(value => value !== '')) rows.push(row);
      row = []; field = ''; closedQuote = false;
    } else {
      if (closedQuote) throw new Error('CSV has characters after a closing quote');
      field += char;
    }
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field');
  if (row.length > 0 || field !== '' || closedQuote) {
    row.push(field);
    if (row.some(value => value !== '')) rows.push(row);
  }
  return rows;
}

function bool(value: string, label: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${label} must be true or false`);
}

function numberField(value: string, label: string, min: number, max: number, integer = false): number {
  if (value.trim() === '') throw new Error(`${label} is required`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${label} must be ${integer ? 'an integer' : 'a number'} from ${min} to ${max}`);
  }
  return parsed;
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function rounded(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(4));
}

export function scoreStudyResponses(stimuliValue: unknown, answerKeyValue: unknown, csv: string): StudyScore {
  validateStudyMaterials(stimuliValue, answerKeyValue);
  const stimuli = object(stimuliValue, 'Stimuli');
  const answerKey = object(answerKeyValue, 'Answer key');
  const tasks = stimuli.tasks as Json[];
  const taskIds = new Set(tasks.map(task => String(task.task_id)));
  const taskSetById = new Map(tasks.map(task => [String(task.task_id), String(task.scenario_set)]));
  const answers = answerKey.answers as Record<string, string>;
  const version = String(stimuli.version);
  const timeLimit = Number(stimuli.time_limit_seconds);
  const parsedRows = parseCsv(csv);
  if (parsedRows.length < 1) throw new Error('CSV is empty');
  const header = parsedRows[0];
  if (new Set(header).size !== header.length || REQUIRED_COLUMNS.some(column => !header.includes(column))) {
    throw new Error(`CSV header must include: ${REQUIRED_COLUMNS.join(', ')}`);
  }
  const indices = Object.fromEntries(header.map((name, index) => [name, index]));
  const seenTrialKeys = new Set<string>();
  const seenParticipantTasks = new Set<string>();
  const seenParticipantConditions = new Set<string>();
  const seenOrders = new Set<string>();
  const participants = new Set<string>();
  const responses: ScoredResponse[] = [];
  const participantRows = new Map<string, Array<{ order: number; condition: RecallCondition; scenarioSet: string }>>();

  for (const [lineIndex, values] of parsedRows.slice(1).entries()) {
    const line = lineIndex + 2;
    if (values.length !== header.length) throw new Error(`CSV row ${line} has ${values.length} columns; expected ${header.length}`);
    const row: Row = Object.fromEntries(header.map((name, index) => [name, values[index]]));
    const participant = row.participant_code;
    if (!/^[A-Za-z0-9_-]{3,64}$/.test(participant)) throw new Error(`CSV row ${line} participant_code must be a non-identifying code of 3–64 letters, numbers, _ or -`);
    if (row.scenario_version !== version) throw new Error(`CSV row ${line} scenario version does not match ${version}`);
    if (!taskIds.has(row.task_id)) throw new Error(`CSV row ${line} refers to unknown task ${row.task_id}`);
    if (!isCondition(row.condition)) throw new Error(`CSV row ${line} has an unknown condition`);
    const trialKey = `${participant}:${row.task_id}:${row.condition}`;
    if (seenTrialKeys.has(trialKey)) throw new Error(`CSV row ${line} duplicates participant/task/condition`);
    seenTrialKeys.add(trialKey);
    if (seenParticipantTasks.has(`${participant}:${row.task_id}`)) throw new Error(`CSV row ${line} repeats a participant task across conditions`);
    seenParticipantTasks.add(`${participant}:${row.task_id}`);
    if (seenParticipantConditions.has(`${participant}:${row.condition}`)) throw new Error(`CSV row ${line} repeats a participant condition`);
    seenParticipantConditions.add(`${participant}:${row.condition}`);
    participants.add(participant);
    const order = numberField(row.order_index, `CSV row ${line} order_index`, 1, 3, true);
    const orderKey = `${participant}:${order}`;
    if (seenOrders.has(orderKey)) throw new Error(`CSV row ${line} duplicates a participant order_index`);
    seenOrders.add(orderKey);
    const rowsForParticipant = participantRows.get(participant) ?? [];
    rowsForParticipant.push({ order, condition: row.condition, scenarioSet: taskSetById.get(row.task_id)! });
    participantRows.set(participant, rowsForParticipant);
    if (!UUID.test(row.submitted_memory_id)) throw new Error(`CSV row ${line} submitted_memory_id must be a UUID`);
    const elapsed = numberField(row.elapsed_seconds, `CSV row ${line} elapsed_seconds`, 0, timeLimit);
    const confidence = numberField(row.confidence_1_to_7, `CSV row ${line} confidence_1_to_7`, 1, 7, true);
    const workload = numberField(row.workload_1_to_7, `CSV row ${line} workload_1_to_7`, 1, 7, true);
    responses.push({
      participant,
      condition: row.condition,
      correct: row.submitted_memory_id.toLowerCase() === answers[row.task_id].toLowerCase(),
      found: bool(row.found_target, `CSV row ${line} found_target`),
      elapsed,
      confidence,
      workload,
      technicalIssue: bool(row.technical_issue, `CSV row ${line} technical_issue`),
    });
  }

  const scheduleRows = stimuli.counterbalance as Json[];
  for (const [participant, rows] of participantRows) {
    const matchesSchedule = scheduleRows.some(rawSchedule => {
      const schedule = rawSchedule as Json;
      const sequence = schedule.sequence as Json[];
      return rows.every(row => {
        const expected = sequence[row.order - 1] as Json;
        return expected.condition === row.condition && expected.scenario_set === row.scenarioSet;
      });
    });
    if (!matchesSchedule) throw new Error(`Participant ${participant} responses do not follow any registered counterbalance schedule`);
  }

  const conditionScores = CONDITIONS.map(condition => {
    const selected = responses.filter(response => response.condition === condition);
    const correct = selected.filter(response => response.correct);
    return {
      condition,
      n: selected.length,
      correct: correct.length,
      accuracy: selected.length ? rounded(correct.length / selected.length) : null,
      foundTargetRate: selected.length ? rounded(selected.filter(response => response.found).length / selected.length) : null,
      meanCorrectSeconds: rounded(average(correct.map(response => response.elapsed))),
      meanConfidence: rounded(average(selected.map(response => response.confidence))),
      meanWorkload: rounded(average(selected.map(response => response.workload))),
      technicalIssueCount: selected.filter(response => response.technicalIssue).length,
    } satisfies ConditionScore;
  });

  const participantConditionRates = new Map<string, Map<RecallCondition, number>>();
  for (const participant of participants) {
    const byCondition = new Map<RecallCondition, number>();
    for (const condition of CONDITIONS) {
      const selected = responses.filter(response => response.participant === participant && response.condition === condition);
      if (selected.length) byCondition.set(condition, selected.filter(response => response.correct).length / selected.length);
    }
    participantConditionRates.set(participant, byCondition);
  }
  const complete = [...participantConditionRates.values()].filter(values => CONDITIONS.every(condition => values.has(condition)));
  const pairedDelta = (condition: RecallCondition): number[] => complete.map(values => values.get(condition)! - values.get('conventional')!);
  const pairedSummary = (condition: RecallCondition) => {
    const values = pairedDelta(condition);
    return {
      mean: rounded(average(values)),
      interval: values.length >= 2 ? confidenceInterval95(values) : null,
    };
  };
  const spatial = pairedSummary('spatial');
  const associative = pairedSummary('associative');
  return {
    scenarioVersion: version,
    taskCount: tasks.length,
    responseCount: responses.length,
    participantCount: participants.size,
    completeParticipantCount: complete.length,
    conditions: conditionScores,
    pairedAccuracy: {
      n: complete.length,
      spatialMinusConventional: spatial.mean,
      spatialMinusConventionalCi95: spatial.interval,
      associativeMinusConventional: associative.mean,
      associativeMinusConventionalCi95: associative.interval,
    },
  };
}

export function renderStudyScoreMarkdown(score: StudyScore): string {
  const pct = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
  const seconds = (value: number | null) => value === null ? '—' : `${value.toFixed(2)} s`;
  const lines = [
    '# Human study response summary', '',
    `Scenario version: ${score.scenarioVersion} · Tasks: ${score.taskCount} · Responses: ${score.responseCount} · Participants: ${score.participantCount} · Complete participants: ${score.completeParticipantCount}`, '',
    'Correctness is computed from submitted memory IDs and the frozen answer key. This is descriptive output; it does not establish cognitive validity or treatment effectiveness.', '',
    '| Condition | Responses | Correct | Accuracy | Found target | Mean time when correct | Mean confidence | Mean workload | Technical issues |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...score.conditions.map(row => `| ${row.condition} | ${row.n} | ${row.correct} | ${pct(row.accuracy)} | ${pct(row.foundTargetRate)} | ${seconds(row.meanCorrectSeconds)} | ${row.meanConfidence?.toFixed(2) ?? '—'} | ${row.meanWorkload?.toFixed(2) ?? '—'} | ${row.technicalIssueCount} |`), '',
    `Paired accuracy among complete participants (n=${score.pairedAccuracy.n}): spatial − conventional ${score.pairedAccuracy.spatialMinusConventional?.toFixed(4) ?? '—'}; associative − conventional ${score.pairedAccuracy.associativeMinusConventional?.toFixed(4) ?? '—'}.`,
  ];
  if (score.pairedAccuracy.spatialMinusConventionalCi95) {
    const ci = score.pairedAccuracy.spatialMinusConventionalCi95;
    lines.push(`Spatial paired 95% t interval: [${ci.lower.toFixed(4)}, ${ci.upper.toFixed(4)}].`);
  }
  if (score.pairedAccuracy.associativeMinusConventionalCi95) {
    const ci = score.pairedAccuracy.associativeMinusConventionalCi95;
    lines.push(`Associative paired 95% t interval: [${ci.lower.toFixed(4)}, ${ci.upper.toFixed(4)}].`);
  }
  lines.push('', 'Intervals are descriptive and should not be interpreted as confirmatory evidence without a preregistered analysis plan and an appropriate sample size.', '');
  return lines.join('\n');
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function verifyDatabase(): Promise<void> {
  const { pool } = await import('../lib/db/pool');
  const stimuli = JSON.parse(readFileSync('docs/evaluation/study/stimuli-v1.json', 'utf8')) as Json;
  const key = JSON.parse(readFileSync('docs/evaluation/study/answer-key-v1.json', 'utf8')) as Json;
  validateStudyMaterials(stimuli, key);
  const answers = key.answers as Record<string, string>;
  const tasks = stimuli.tasks as Json[];
  try {
    const count = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM memories');
    const failures: string[] = [];
    for (const task of tasks) {
      const id = String(task.task_id);
      const condition = task.conditions as Json;
      const conventional = condition.conventional as Json;
      const spatial = condition.spatial as Json;
      const associative = condition.associative as Json;
      const route = spatial.route as Json;
      const result = await pool.query<{
        title: string;
        date_match: boolean;
        text_match: boolean;
        spatial_match: boolean;
        edge_match: boolean;
        seed_in_graph_view: boolean;
        target_in_graph_view: boolean;
        activation: number | null;
      }>(`
        SELECT m.title,
          m.occurred_at >= $4::timestamptz AND m.occurred_at <= $5::timestamptz AS date_match,
          to_tsvector('english',m.title||' '||m.content) @@ websearch_to_tsquery('english',$6) AS text_match,
          EXISTS(SELECT 1 FROM spatial_memory_walk($2::jsonb,$3::float8) walk WHERE walk.memory_id=m.id) AS spatial_match,
          EXISTS(SELECT 1 FROM associative_recall($7::uuid,$8::int,$9::float8,1) recall WHERE recall.memory_id=m.id) AS edge_match,
          EXISTS(SELECT 1 FROM (SELECT id FROM memories ORDER BY occurred_at DESC,id LIMIT 100) visible WHERE visible.id=$7::uuid) AS seed_in_graph_view,
          EXISTS(SELECT 1 FROM (SELECT id FROM memories ORDER BY occurred_at DESC,id LIMIT 100) visible WHERE visible.id=m.id) AS target_in_graph_view,
          (SELECT recall.activation FROM associative_recall($7::uuid,$8::int,$9::float8,1) recall WHERE recall.memory_id=m.id) AS activation
        FROM memories m WHERE m.id=$1::uuid
      `, [answers[id], JSON.stringify(route), spatial.radius_meters, conventional.from, conventional.to, conventional.search_text, associative.seed_memory_id, associative.depth, associative.threshold]);
      const row = result.rows[0];
      if (!row) failures.push(`${id}: answer memory is absent`);
      else {
        if (!row.date_match) failures.push(`${id}: target falls outside its conventional date range`);
        if (!row.text_match) failures.push(`${id}: conventional full-text query misses the target`);
        if (!row.spatial_match) failures.push(`${id}: target is outside the supplied spatial corridor`);
        if (!row.edge_match) failures.push(`${id}: associative seed has no directed edge to the target`);
        if (!row.seed_in_graph_view) failures.push(`${id}: associative seed is outside the graph page's first 100 memories`);
        if (!row.target_in_graph_view) failures.push(`${id}: answer memory is outside the graph page's first 100 memories`);
        if (row.activation === null || row.activation < Number(associative.threshold)) failures.push(`${id}: associative activation falls below the pruning threshold`);
      }
    }
    if (failures.length) throw new Error(`Study dataset check failed:\n- ${failures.join('\n- ')}`);
    console.log(JSON.stringify({ valid: true, memoryCount: count.rows[0].count, scenarioVersion: stimuli.version, checkedTasks: tasks.length }, null, 2));
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const [command, inputPath, outputPrefix] = process.argv.slice(2);
  const stimuliPath = 'docs/evaluation/study/stimuli-v1.json';
  const keyPath = 'docs/evaluation/study/answer-key-v1.json';
  const stimuli = JSON.parse(readFileSync(stimuliPath, 'utf8')) as unknown;
  const key = JSON.parse(readFileSync(keyPath, 'utf8')) as unknown;
  validateStudyMaterials(stimuli, key);

  if (command === 'validate') {
    const pack = object(stimuli, 'Stimuli');
    console.log(JSON.stringify({
      valid: true,
      version: pack.version,
      taskCount: (pack.tasks as unknown[]).length,
      stimuliSha256: sha256(stimuliPath),
      answerKeySha256: sha256(keyPath),
      note: 'Record both hashes with the approved study protocol before data collection.',
    }, null, 2));
    return;
  }
  if (command === 'verify-db') {
    await verifyDatabase();
    return;
  }
  if (command === 'score') {
    if (!inputPath) throw new Error('Usage: npm run study:score -- <responses.csv> [output-prefix]');
    const score = scoreStudyResponses(stimuli, key, readFileSync(inputPath, 'utf8'));
    const markdown = renderStudyScoreMarkdown(score);
    if (outputPrefix) {
      writeFileSync(`${outputPrefix}.json`, `${JSON.stringify(score, null, 2)}\n`, { flag: 'wx' });
      writeFileSync(`${outputPrefix}.md`, markdown, { flag: 'wx' });
      console.log(`Wrote aggregate-only report to ${outputPrefix}.json and ${outputPrefix}.md`);
    } else {
      console.log(markdown);
    }
    return;
  }
  throw new Error('Usage: npm run study:validate | npm run study:verify-db | npm run study:score -- <responses.csv> [output-prefix]');
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/human-study.ts')) {
  void main().catch(error => {
    console.error('Human study utility failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
