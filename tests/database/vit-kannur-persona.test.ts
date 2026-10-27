import { describe, expect, it } from 'vitest';
import { buildVitKannurPersona } from '../../scripts/vit-kannur-persona';

describe('VIT–Kannur synthetic student dataset', () => {
  const dataset = buildVitKannurPersona();

  it('builds a sizeable deterministic, internally linked life history', () => {
    expect(dataset.memories.length).toBeGreaterThanOrEqual(120);
    expect(new Set(dataset.memories.map((memory) => memory.key)).size).toBe(dataset.memories.length);
    expect(new Set(dataset.memories.map((memory) => memory.title)).size).toBe(dataset.memories.length);
    expect(dataset.memories.every((memory) => memory.contexts.length > 0)).toBe(true);
    expect(dataset.memories.every((memory) => memory.contexts.every((key) => dataset.contexts.some((context) => context.key === key)))).toBe(true);
    expect(dataset.memories.every((memory) => memory.locationKey in dataset.locations)).toBe(true);
    expect(dataset.memories.every((memory, index) => index === 0 || Date.parse(dataset.memories[index - 1].occurredAt) <= Date.parse(memory.occurredAt))).toBe(true);
    expect(buildVitKannurPersona()).toEqual(dataset);
    expect(dataset.memories.every((memory) => memory.contexts.includes('persona'))).toBe(true);
  });

  it('covers VIT, Kannur, holidays, journeys, vacations, and personal routines', () => {
    const text = dataset.memories.map((memory) => `${memory.title} ${memory.content}`).join(' ').toLowerCase();
    for (const phrase of ['vit vellore', 'kannur', 'onam', 'vishu', 'train', 'vacation', 'exam', 'football', 'family']) {
      expect(text, `expected the story to include ${phrase}`).toContain(phrase);
    }
    expect(dataset.locations['vit-campus']).toBeDefined();
    expect(dataset.locations['kannur-home']).toBeDefined();
    expect(dataset.memories.some((memory) => memory.locationKey === 'kannur-home')).toBe(true);
    expect(dataset.memories.some((memory) => memory.locationKey === 'vit-campus')).toBe(true);
  });

  it('keeps dates, strengths, decay, coordinates, and graph endpoints valid', () => {
    for (const memory of dataset.memories) {
      expect(Number.isFinite(Date.parse(memory.occurredAt))).toBe(true);
      expect(memory.strength).toBeGreaterThanOrEqual(0);
      expect(memory.strength).toBeLessThanOrEqual(1);
      expect(memory.decayRate).toBeGreaterThanOrEqual(0);
    }
    for (const location of Object.values(dataset.locations)) {
      expect(location.longitude).toBeGreaterThanOrEqual(-180);
      expect(location.longitude).toBeLessThanOrEqual(180);
      expect(location.latitude).toBeGreaterThanOrEqual(-90);
      expect(location.latitude).toBeLessThanOrEqual(90);
    }
    const keys = new Set(dataset.memories.map((memory) => memory.key));
    expect(dataset.edges.length).toBeGreaterThan(100);
    expect(dataset.edges.every((edge) => keys.has(edge.source) && keys.has(edge.target) && edge.source !== edge.target)).toBe(true);
  });
});
