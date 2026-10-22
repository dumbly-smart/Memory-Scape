import { describe, expect, it } from 'vitest';
import { algorithmParametersSchema, defaultAlgorithmParameters } from '../../lib/algorithm-parameters';

describe('algorithm parameter contract', () => {
  it('accepts defaults and bounded coefficient sets', () => {
    expect(algorithmParametersSchema.safeParse(defaultAlgorithmParameters).success).toBe(true);
    expect(algorithmParametersSchema.safeParse({
      valenceBase: 0.6, valenceSalience: 0.4,
      reviewStrengthWeight: 0.6, reviewAgeWeight: 0.4, reviewAgeCapDays: 30,
    }).success).toBe(true);
  });

  it('rejects coefficient pairs that do not sum to one and unsafe age caps', () => {
    expect(algorithmParametersSchema.safeParse({ ...defaultAlgorithmParameters, valenceBase: 0.6 }).success).toBe(false);
    expect(algorithmParametersSchema.safeParse({ ...defaultAlgorithmParameters, reviewAgeCapDays: 0 }).success).toBe(false);
  });
});
