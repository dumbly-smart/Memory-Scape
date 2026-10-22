export interface MeasurementSummary {
  count: number;
  mean: number;
  median: number;
  standardDeviation: number;
  minimum: number;
  maximum: number;
}

export interface MeanConfidenceInterval {
  lower: number;
  upper: number;
}

const T_95_TWO_SIDED = [
  Number.NaN,
  12.706,
  4.303,
  3.182,
  2.776,
  2.571,
  2.447,
  2.365,
  2.306,
  2.262,
  2.228,
  2.201,
  2.179,
  2.160,
  2.145,
  2.131,
  2.120,
  2.110,
  2.101,
  2.093,
  2.086,
  2.080,
  2.074,
  2.069,
  2.064,
  2.060,
  2.056,
  2.052,
  2.048,
  2.045,
  2.042,
];

export function confidenceInterval95(values: number[]): MeanConfidenceInterval {
  if (values.length < 2) throw new Error('Expected at least two measurements for a confidence interval');
  const summary = summarizeMeasurements(values);
  const degreesOfFreedom = values.length - 1;
  const criticalValue = T_95_TWO_SIDED[degreesOfFreedom] ?? 1.96;
  const margin = criticalValue * summary.standardDeviation / Math.sqrt(values.length);
  return { lower: summary.mean - margin, upper: summary.mean + margin };
}

export function summarizeMeasurements(values: number[]): MeasurementSummary {
  if (values.length === 0 || values.some(value => !Number.isFinite(value))) {
    throw new Error('Expected at least one finite measurement');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.length < 2
    ? 0
    : values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  return {
    count: values.length,
    mean,
    median,
    standardDeviation: Math.sqrt(variance),
    minimum: sorted[0],
    maximum: sorted[sorted.length - 1],
  };
}
