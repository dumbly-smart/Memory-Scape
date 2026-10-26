export type RetrievalMetrics = {
  precision: number;
  recall: number;
  f1: number;
  reciprocalRank: number;
  relevantRetrieved: number;
  resultCount: number;
  expectedCount: number;
};

export function scoreRetrieval(expectedIds: readonly string[], rankedIds: readonly string[]): RetrievalMetrics {
  const expected = new Set(expectedIds);
  const ranked = [...new Set(rankedIds)];
  const relevantRetrieved = ranked.filter(id => expected.has(id)).length;
  const precision = ranked.length ? relevantRetrieved / ranked.length : 0;
  const recall = expected.size ? relevantRetrieved / expected.size : 0;
  const reciprocalRank = ranked.findIndex(id => expected.has(id)) >= 0
    ? 1 / (ranked.findIndex(id => expected.has(id)) + 1)
    : 0;
  return {
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    reciprocalRank,
    relevantRetrieved,
    resultCount: ranked.length,
    expectedCount: expected.size,
  };
}

export type CalibrationCandidate = {
  valenceSalience: number;
  threshold: number;
  metrics: Pick<RetrievalMetrics, 'f1' | 'reciprocalRank'>;
};

export function rankCalibrationCandidates<T extends CalibrationCandidate>(candidates: readonly T[]): T[] {
  return [...candidates].sort((left, right) =>
    right.metrics.f1 - left.metrics.f1
      || right.metrics.reciprocalRank - left.metrics.reciprocalRank
      || left.threshold - right.threshold
      || left.valenceSalience - right.valenceSalience,
  );
}

export function selectCalibrationResult<T extends CalibrationCandidate>(candidates: readonly T[]): T | undefined {
  return rankCalibrationCandidates(candidates)[0];
}
