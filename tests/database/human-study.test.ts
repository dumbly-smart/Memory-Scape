import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scoreStudyResponses, validateStudyMaterials } from '../../scripts/human-study';

const stimuli = JSON.parse(readFileSync('docs/evaluation/study/stimuli-v1.json', 'utf8')) as Record<string, unknown>;
const answerKey = JSON.parse(readFileSync('docs/evaluation/study/answer-key-v1.json', 'utf8')) as Record<string, unknown>;

describe('human study materials', () => {
  it('validates the frozen, counterbalanced scenario pack and matching answer key', () => {
    expect(() => validateStudyMaterials(stimuli, answerKey)).not.toThrow();
    expect(() => validateStudyMaterials(stimuli, { ...answerKey, version: 'wrong-version' })).toThrow(/version/);
    const unbalanced = structuredClone(stimuli) as typeof stimuli;
    const orders = unbalanced.counterbalance as Array<Record<string, unknown>>;
    const firstOrder = orders[0];
    const sequence = firstOrder.sequence as Array<Record<string, unknown>>;
    sequence[0].condition = 'spatial';
    expect(() => validateStudyMaterials(unbalanced, answerKey)).toThrow(/sequence|balanced/i);
  });

  it('rejects invalid routes and missing condition parameters', () => {
    const tasks = stimuli.tasks as Array<Record<string, unknown>>;
    const first = tasks[0];
    const conditions = first.conditions as Record<string, unknown>;
    const spatial = conditions.spatial as Record<string, unknown>;
    const route = spatial.route as { coordinates: number[][] };
    const invalid = structuredClone(stimuli) as typeof stimuli;
    const invalidTasks = invalid.tasks as Array<Record<string, unknown>>;
    const invalidConditions = invalidTasks[0].conditions as Record<string, unknown>;
    const invalidSpatial = invalidConditions.spatial as Record<string, unknown>;
    invalidSpatial.route = { type: 'LineString', coordinates: [route.coordinates[0]] };
    expect(() => validateStudyMaterials(invalid, answerKey)).toThrow(/route/i);

    const degenerate = structuredClone(stimuli) as typeof stimuli;
    const degenerateTasks = degenerate.tasks as Array<Record<string, unknown>>;
    const degenerateConditions = degenerateTasks[0].conditions as Record<string, unknown>;
    const degenerateSpatial = degenerateConditions.spatial as Record<string, unknown>;
    const point = route.coordinates[0];
    degenerateSpatial.route = { type: 'LineString', coordinates: [point, point] };
    expect(() => validateStudyMaterials(degenerate, answerKey)).toThrow(/degenerate/i);
  });

  it('scores submitted memory IDs from the frozen key and reports paired accuracy', () => {
    const key = answerKey.answers as Record<string, string>;
    const rows = [
      ['P-001', 'v1', 'A-01', 'conventional', '1', key['A-01'], 'true', '12', '6', '3', 'false'],
      ['P-001', 'v1', 'B-01', 'spatial', '2', key['B-01'], 'true', '8', '5', '2', 'false'],
      ['P-001', 'v1', 'C-01', 'associative', '3', '00000000-0000-0000-0000-000000000000', 'false', '30', '2', '6', 'false'],
    ];
    const csv = [
      'participant_code,scenario_version,task_id,condition,order_index,submitted_memory_id,found_target,elapsed_seconds,confidence_1_to_7,workload_1_to_7,technical_issue',
      ...rows.map(row => row.join(',')),
    ].join('\n');
    const report = scoreStudyResponses(stimuli, answerKey, csv);
    expect(report.conditions).toMatchObject([
      { condition: 'conventional', n: 1, correct: 1, accuracy: 1 },
      { condition: 'spatial', n: 1, correct: 1, accuracy: 1 },
      { condition: 'associative', n: 1, correct: 0, accuracy: 0 },
    ]);
    expect(report.pairedAccuracy).toMatchObject({ n: 1, spatialMinusConventional: 0, associativeMinusConventional: -1 });
  });

  it('rejects duplicate participant/task/condition rows and malformed CSV', () => {
    const header = 'participant_code,scenario_version,task_id,condition,order_index,submitted_memory_id,found_target,elapsed_seconds,confidence_1_to_7,workload_1_to_7,technical_issue';
    const row = 'P-001,v1,A-01,conventional,1,00000000-0000-0000-0000-000000000000,false,4,4,4,false';
    expect(() => scoreStudyResponses(stimuli, answerKey, `${header}\n${row}\n${row}`)).toThrow(/duplicate/i);
    expect(() => scoreStudyResponses(stimuli, answerKey, `${header}\n"unterminated`)).toThrow(/CSV/i);
    const impossibleSchedule = 'P-002,v1,A-01,associative,1,00000000-0000-0000-0000-000000000000,false,4,4,4,false';
    expect(() => scoreStudyResponses(stimuli, answerKey, `${header}\n${impossibleSchedule}`)).toThrow(/counterbalance/i);
  });
});
