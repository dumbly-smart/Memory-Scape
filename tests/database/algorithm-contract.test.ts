import { describe, expect, it } from 'vitest';
import { decayStrength, reinforceStrength } from '../../lib/algorithms';

describe('database algorithm contracts', () => {
  it('applies exponential decay in elapsed days', () => {
    expect(decayStrength(1, 0.1, 10)).toBeCloseTo(Math.exp(-1));
  });
  it('does not decay at zero elapsed time and clamps bounds', () => {
    expect(decayStrength(0.4, 0.2, 0)).toBe(0.4);
    expect(decayStrength(0.4, 0.2, -4)).toBe(0.4);
    expect(decayStrength(0.4, 10, 10000)).toBe(0);
  });
  it('reinforces a decayed strength toward one', () => {
    expect(reinforceStrength(0.25, 0.2)).toBeCloseTo(0.4);
    expect(reinforceStrength(1, 0.2)).toBe(1);
  });
});
