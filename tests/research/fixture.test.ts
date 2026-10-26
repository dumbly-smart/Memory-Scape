import { describe, expect, it } from 'vitest';
import { createResearchFixture, createSeededRandom, seededShuffle } from '../../lib/research/fixture';

describe('synthetic research fixture', () => {
  it('has deterministic labels, route truth, and graph truth for a fixed seed', () => {
    expect(createResearchFixture(25)).toEqual(createResearchFixture(25));
    expect(createResearchFixture().routeRelevant).toEqual(['seed', 'strong-mid', 'weak-mid', 'target-a', 'target-b', 'three-hop']);
    expect(createResearchFixture().graphRelevant).toEqual(['strong-mid', 'weak-mid', 'target-a', 'target-b', 'three-hop']);
    expect(createResearchFixture().edges.some(edge => edge.target === 'wrong-time' && !createResearchFixture().graphRelevant.includes(edge.target))).toBe(true);
  });

  it('produces a reproducible pseudo-random sequence that changes with its seed', () => {
    expect(Array.from({ length: 4 }, createSeededRandom(25))).toEqual(Array.from({ length: 4 }, createSeededRandom(25)));
    expect(Array.from({ length: 4 }, createSeededRandom(25))).not.toEqual(Array.from({ length: 4 }, createSeededRandom(26)));
  });

  it('rejects seeds outside the unsigned 32-bit range', () => {
    expect(() => createResearchFixture(-1)).toThrow('32-bit unsigned integer');
    expect(() => createSeededRandom(2 ** 32)).toThrow('32-bit unsigned integer');
  });

  it('shuffles edge candidates reproducibly without losing or duplicating entries', () => {
    const values = ['a', 'b', 'c', 'd', 'e'];
    expect(seededShuffle(values, 81)).toEqual(seededShuffle(values, 81));
    expect(seededShuffle(values, 81).sort()).toEqual(values);
    expect(seededShuffle(values, 81)).not.toEqual(seededShuffle(values, 82));
  });
});
