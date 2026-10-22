import { expect, test, type APIRequestContext } from '@playwright/test';

const memoryPayload = (title: string, latitude?: number, longitude?: number) => ({
  title,
  content: 'Synthetic browser integration fixture.',
  occurredAt: new Date().toISOString(),
  latitude: latitude ?? null,
  longitude: longitude ?? null,
  locationLabel: latitude === undefined ? null : 'Test route',
  strength: 0.8,
});

async function createMemory(request: APIRequestContext, payload: ReturnType<typeof memoryPayload>) {
  const response = await request.post('/api/memories', { data: payload });
  expect(response.status()).toBe(201);
  return (await response.json()).data as { id: string; strength: number };
}

test('database-backed route, reinforcement, and associative recall APIs', async ({ request }) => {
  const ids: string[] = [];
  try {
    const located = await createMemory(request, memoryPayload(`Walk fixture ${Date.now()}`, 13.021, 77.568));
    ids.push(located.id);
    const walk = await request.post('/api/spatial/walk', {
      data: { route: { type: 'LineString', coordinates: [[77.567, 13.021], [77.569, 13.021]] }, radiusMeters: 20 },
    });
    expect(walk.ok()).toBeTruthy();
    expect((await walk.json()).data.some((row: { memory_id: string }) => row.memory_id === located.id)).toBeTruthy();

    const seed = await createMemory(request, memoryPayload(`Graph seed ${Date.now()}`));
    const first = await createMemory(request, memoryPayload(`Graph first ${Date.now()}`));
    const second = await createMemory(request, memoryPayload(`Graph second ${Date.now()}`));
    ids.push(seed.id, first.id, second.id);
    const contextLink = await request.post('/api/contexts', { data: { memoryId: seed.id, type: 'Topic', label: 'Browser filter context' } });
    expect(contextLink.status()).toBe(201);
    const contextRows = (await (await request.get('/api/contexts')).json()).data as Array<{ id: string; label: string }>;
    const filterContext = contextRows.find(row => row.label === 'Browser filter context');
    expect(filterContext).toBeTruthy();
    const filtered = await request.get(`/api/memories?context=${filterContext?.id}&minStrength=0.75&hasLocation=false&sort=strength_asc`);
    expect(filtered.ok()).toBeTruthy();
    expect((await filtered.json()).data.some((row: { id: string }) => row.id === seed.id)).toBeTruthy();
    for (const [src, dst] of [[seed.id, first.id], [first.id, second.id]]) {
      const edge = await request.post('/api/edges', { data: { src, dst, type: 'Test association', weight: 0.8, valence: 0.4 } });
      expect(edge.status()).toBe(201);
    }
    const recall = await request.post('/api/associative/recall', { data: { seedId: seed.id, depth: 2, threshold: 0.001 } });
    expect(recall.ok()).toBeTruthy();
    const results = (await recall.json()).data as Array<{ memory_id: string; hop_depth: number; activation: number }>;
    expect(results.find(row => row.memory_id === first.id)?.hop_depth).toBe(1);
    expect(results.find(row => row.memory_id === second.id)?.hop_depth).toBe(2);

    const reinforcement = await request.post('/api/temporal/reinforce', { data: { memoryId: second.id, factor: 0.25, type: 'browser-test' } });
    expect(reinforcement.ok()).toBeTruthy();
    expect((await reinforcement.json()).data.strength).toBeGreaterThan(0.8);
  } finally {
    for (const id of ids) await request.delete(`/api/memories/${id}`);
  }
});
