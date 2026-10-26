import { describe, expect, it } from 'vitest';
import { scoreRetrieval, selectCalibrationResult, summarizeMetricTrials } from '../../lib/research/metrics';

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

  it('summarizes synthetic metric trials with descriptive sample variability', () => {
    expect(summarizeMetricTrials([
      { precision: 0, recall: 0, f1: 0.2, reciprocalRank: 0.4, relevantRetrieved: 1, resultCount: 2, expectedCount: 5 },
      { precision: 0, recall: 0, f1: 0.6, reciprocalRank: 0.8, relevantRetrieved: 3, resultCount: 4, expectedCount: 5 },
      { precision: 0, recall: 0, f1: 1, reciprocalRank: 1, relevantRetrieved: 5, resultCount: 5, expectedCount: 5 },
    ])).toEqual({
      count: 3,
      f1: { mean: 0.6, sampleStandardDeviation: 0.4, minimum: 0.2, maximum: 1 },
      reciprocalRank: { mean: 0.7333333333333334, sampleStandardDeviation: 0.30550504633038933, minimum: 0.4, maximum: 1 },
    });
  });

  it('rejects empty trial sets instead of reporting misleading zero variability', () => {
    expect(() => summarizeMetricTrials([])).toThrow('at least one metric trial');
  });
});
