import { describe, expect, it } from 'vitest';
import { confidenceInterval95, summarizeMeasurements } from '../../scripts/benchmark-stats';

describe('benchmark measurement summaries', () => {
  it('reports mean, median, sample deviation, minimum, and maximum', () => {
    expect(summarizeMeasurements([1, 2, 3])).toEqual({
      count: 3,
      mean: 2,
      median: 2,
      standardDeviation: 1,
      minimum: 1,
      maximum: 3,
    });
  });

  it('uses the midpoint median and zero deviation for a single run', () => {
    expect(summarizeMeasurements([1, 3])).toMatchObject({ count: 2, median: 2 });
    expect(summarizeMeasurements([4])).toMatchObject({ count: 1, median: 4, standardDeviation: 0 });
  });

  it('rejects empty or non-finite samples', () => {
    expect(() => summarizeMeasurements([])).toThrow('at least one finite measurement');
    expect(() => summarizeMeasurements([1, Number.NaN])).toThrow('at least one finite measurement');
  });

  it('computes a Student t 95% interval for a small sample mean', () => {
    const interval = confidenceInterval95([1, 2, 3, 4, 5]);
    expect(interval.lower).toBeCloseTo(1.0371, 3);
    expect(interval.upper).toBeCloseTo(4.9629, 3);
  });

  it('requires at least two finite measurements for a confidence interval', () => {
    expect(() => confidenceInterval95([1])).toThrow('at least two measurements');
    expect(() => confidenceInterval95([1, Number.NaN])).toThrow('at least one finite measurement');
  });
});
