export interface MeasurementSummary {
  count: number;
  mean: number;
  median: number;
  standardDeviation: number;
  minimum: number;
  maximum: number;
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
