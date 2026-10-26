import { describe, expect, it } from 'vitest';
import { exactMcNemarPower, minimumMcNemarSampleSize } from '../../lib/research/study-power';

describe('paired binary study power planning', () => {
  it('uses the exact two-sided conditional test for all-discordant pairs', () => {
    expect(exactMcNemarPower(5, 0.75, 0.25, 0.05)).toBe(0);
    expect(exactMcNemarPower(6, 0.75, 0.25, 0.05)).toBeCloseTo(0.75 ** 6 + 0.25 ** 6, 12);
    expect(exactMcNemarPower(6, 0.375, 0.125, 0.05)).toBeCloseTo((0.5 ** 6) * (0.75 ** 6 + 0.25 ** 6), 12);
  });

  it('finds the first participant count reaching the requested power', () => {
    expect(minimumMcNemarSampleSize({ memoryscapeOnly: 0.75, conventionalOnly: 0.25, alpha: 0.05, targetPower: 0.15, maxParticipants: 10 })).toBe(6);
  });

  it('returns no finite recommendation when the assumed paired effect is absent', () => {
    expect(minimumMcNemarSampleSize({ memoryscapeOnly: 0.15, conventionalOnly: 0.15, alpha: 0.05, targetPower: 0.8, maxParticipants: 100 })).toBeNull();
  });

  it('rejects invalid probabilities and analysis parameters', () => {
    expect(() => exactMcNemarPower(10, 0.7, 0.4, 0.05)).toThrow('discordant probabilities');
    expect(() => exactMcNemarPower(0, 0.2, 0.1, 0.05)).toThrow('participant count');
    expect(() => minimumMcNemarSampleSize({ memoryscapeOnly: 0.2, conventionalOnly: 0.1, alpha: 0.7, targetPower: 0.8, maxParticipants: 100 })).toThrow('alpha');
  });
});
