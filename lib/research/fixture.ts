export type ResearchMemory = {
  label: string;
  title: string;
  longitude: number;
  latitude: number;
  occurredAt: string;
  strength: number;
  decayRate?: number;
  relevantToRoute: boolean;
  relevantToGraph: boolean;
};

export type ResearchEdge = { source: string; target: string; type: string; weight: number; valence: number };

export type ResearchFixture = {
  seed: number;
  route: { type: 'LineString'; coordinates: [[number, number], [number, number]] };
  radiusMeters: number;
  from: string;
  until: string;
  memories: ResearchMemory[];
  edges: ResearchEdge[];
  routeRelevant: string[];
  graphRelevant: string[];
};

export function createResearchFixture(seed = 497): ResearchFixture {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Research fixture seed must be a 32-bit unsigned integer');
  const memories: ResearchMemory[] = [
    { label: 'seed', title: 'Synthetic route and graph seed', longitude: -122, latitude: 37, occurredAt: '2025-01-01T12:00:00.000Z', strength: 1, relevantToRoute: true, relevantToGraph: false },
    { label: 'strong-mid', title: 'Synthetic strong path intermediate', longitude: -121.997, latitude: 37.00002, occurredAt: '2025-01-01T12:15:00.000Z', strength: 0.8, relevantToRoute: true, relevantToGraph: true },
    { label: 'weak-mid', title: 'Synthetic alternate path intermediate', longitude: -121.995, latitude: 36.99998, occurredAt: '2025-01-01T12:20:00.000Z', strength: 0.8, relevantToRoute: true, relevantToGraph: true },
    { label: 'target-a', title: 'Synthetic expected route and graph target A', longitude: -121.993, latitude: 37, occurredAt: '2025-01-01T12:30:00.000Z', strength: 0.9, relevantToRoute: true, relevantToGraph: true },
    { label: 'target-b', title: 'Synthetic expected route and graph target B', longitude: -121.991, latitude: 37.00001, occurredAt: '2025-01-01T13:15:00.000Z', strength: 0.85, relevantToRoute: true, relevantToGraph: true },
    { label: 'three-hop', title: 'Synthetic three-hop graph target', longitude: -121.992, latitude: 37, occurredAt: '2025-01-01T13:30:00.000Z', strength: 0.75, relevantToRoute: true, relevantToGraph: true },
    { label: 'wrong-time', title: 'Synthetic route memory outside time window', longitude: -121.996, latitude: 37, occurredAt: '2025-01-01T14:00:00.000Z', strength: 0.9, relevantToRoute: false, relevantToGraph: false },
    { label: 'off-route', title: 'Synthetic event outside route corridor', longitude: -121.995, latitude: 37.01, occurredAt: '2025-01-01T12:45:00.000Z', strength: 0.9, relevantToRoute: false, relevantToGraph: false },
  ];
  const edges: ResearchEdge[] = [
    { source: 'seed', target: 'strong-mid', type: 'strong first hop', weight: 0.9, valence: 0.8 },
    { source: 'strong-mid', target: 'target-a', type: 'strong second hop', weight: 0.9, valence: 0.6 },
    { source: 'seed', target: 'weak-mid', type: 'alternate first hop', weight: 0.45, valence: -0.9 },
    { source: 'weak-mid', target: 'target-a', type: 'alternate second hop', weight: 0.8, valence: -0.2 },
    { source: 'seed', target: 'target-b', type: 'direct association', weight: 0.55, valence: 0 },
    { source: 'seed', target: 'wrong-time', type: 'high-weight negative control', weight: 0.95, valence: 0 },
    { source: 'target-b', target: 'three-hop', type: 'chain continuation', weight: 0.8, valence: 0.4 },
    { source: 'three-hop', target: 'target-a', type: 'convergent association', weight: 0.7, valence: 0.5 },
    { source: 'target-a', target: 'seed', type: 'cycle for pruning validation', weight: 1, valence: 1 },
  ];
  return {
    seed,
    route: { type: 'LineString', coordinates: [[-122, 37], [-121.99, 37]] },
    radiusMeters: 75,
    from: '2025-01-01T12:00:00.000Z',
    until: '2025-01-01T14:00:00.000Z',
    memories,
    edges,
    routeRelevant: memories.filter(memory => memory.relevantToRoute).map(memory => memory.label),
    graphRelevant: memories.filter(memory => memory.relevantToGraph).map(memory => memory.label),
  };
}

export function createSeededRandom(seed: number): () => number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Random seed must be a 32-bit unsigned integer');
  let state = seed || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const random = createSeededRandom(seed);
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}
