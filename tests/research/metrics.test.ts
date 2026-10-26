import { describe, expect, it } from 'vitest';
import { scoreRetrieval, selectCalibrationResult } from '../../lib/research/metrics';

describe('synthetic retrieval metrics', () => {
  it('computes precision, recall, F1, and reciprocal rank from ranked IDs', () => {
    expect(scoreRetrieval(['a', 'b'], ['x', 'b', 'a'])).toEqual({
      precision: 2 / 3,
      recall: 1,
      f1: 0.8,
      reciprocalRank: 0.5,
      relevantRetrieved: 2,
      resultCount: 3,
      expectedCount: 2,
    });
  });

  it('returns zero quality metrics for empty result or relevance sets', () => {
    expect(scoreRetrieval(['a'], [])).toEqual({ precision: 0, recall: 0, f1: 0, reciprocalRank: 0, relevantRetrieved: 0, resultCount: 0, expectedCount: 1 });
    expect(scoreRetrieval([], ['a'])).toEqual({ precision: 0, recall: 0, f1: 0, reciprocalRank: 0, relevantRetrieved: 0, resultCount: 1, expectedCount: 0 });
  });

  it('counts each retrieved memory once and uses its first ranked occurrence', () => {
    expect(scoreRetrieval(['a'], ['a', 'a'])).toEqual({ precision: 1, recall: 1, f1: 1, reciprocalRank: 1, relevantRetrieved: 1, resultCount: 1, expectedCount: 1 });
  });

  it('selects calibration by quality before deterministic lower-threshold tie breaks', () => {
    const candidates = [
      { valenceSalience: 0.5, threshold: 0.05, metrics: { f1: 1, reciprocalRank: 1 } },
      { valenceSalience: 0, threshold: 0.01, metrics: { f1: 1, reciprocalRank: 0.5 } },
      { valenceSalience: 0.25, threshold: 0.05, metrics: { f1: 1, reciprocalRank: 1 } },
      { valenceSalience: 0.25, threshold: 0.01, metrics: { f1: 1, reciprocalRank: 1 } },
    ];
    expect(selectCalibrationResult(candidates)).toBe(candidates[3]);
    expect(selectCalibrationResult([])).toBeUndefined();
  });
});
