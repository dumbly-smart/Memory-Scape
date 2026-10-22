import { expect, test, type APIRequestContext } from '@playwright/test';

async function createFixture(request: APIRequestContext, title: string) {
  const response = await request.post('/api/memories', { data: {
    title,
    content: 'API contract fixture.',
    occurredAt: new Date().toISOString(),
    strength: 0.5,
  } });
  expect(response.status()).toBe(201);
  return (await response.json()).data.id as string;
}

test('rejects invalid payloads and reports missing memory records with client errors', async ({ request }) => {
  const badMemory = await request.post('/api/memories', { data: { title: ' ', occurredAt: 'not-a-time' } });
  expect(badMemory.status()).toBe(400);

  const badId = await request.get('/api/memories/not-a-uuid');
  expect(badId.status()).toBe(400);
  const missingId = '00000000-0000-4000-8000-000000000001';
  expect((await request.get(`/api/memories/${missingId}`)).status()).toBe(404);
  expect((await request.delete(`/api/memories/${missingId}`)).status()).toBe(404);

  expect((await request.get('/api/memories?sort=client_sql')).status()).toBe(400);
  expect((await request.post('/api/spatial/walk', { data: {
    route: { type: 'LineString', coordinates: [[77.5, 13.0]] }, radiusMeters: 100,
  } })).status()).toBe(400);
  expect((await request.post('/api/associative/recall', { data: {
    seedId: missingId, depth: 4,
  } })).status()).toBe(400);
});

test('context linking is idempotent and edge constraints have useful status codes', async ({ request }) => {
  const suffix = Date.now();
  const source = await createFixture(request, `Context contract source ${suffix}`);
  const target = await createFixture(request, `Context contract target ${suffix}`);
  try {
    const contextPayload = { memoryId: source, type: 'Topic', label: `Idempotent contract ${suffix}` };
    const firstLink = await request.post('/api/contexts', { data: contextPayload });
    const duplicateLink = await request.post('/api/contexts', { data: contextPayload });
    expect((await firstLink.json()).data.inserted).toBe(true);
    expect((await duplicateLink.json()).data.inserted).toBe(false);

    const detail = (await (await request.get(`/api/memories/${source}`)).json()).data;
    const history = (await (await request.get(`/api/temporal/history/${source}`)).json()).data;
    expect(detail.strength).toBeGreaterThan(0.5);
    expect(history.filter((item: { reinforcement_type: string }) => item.reinforcement_type === 'new_context')).toHaveLength(1);
    const context = detail.contexts.find((item: { label: string }) => item.label === contextPayload.label);
    expect(context).toBeTruthy();

    expect((await request.delete(`/api/memories/${source}/contexts/${context.id}`)).status()).toBe(200);
    expect((await request.delete(`/api/memories/${source}/contexts/${context.id}`)).status()).toBe(404);

    const edgePayload = { src: source, dst: target, type: 'Contract duplicate', weight: 0.7, valence: -0.5 };
    const edge = await request.post('/api/edges', { data: edgePayload });
    expect(edge.status()).toBe(201);
    expect((await request.post('/api/edges', { data: edgePayload })).status()).toBe(409);
    const edgeId = (await edge.json()).data.id;
    expect((await request.delete(`/api/edges/${edgeId}`)).status()).toBe(200);
    expect((await request.delete(`/api/edges/${edgeId}`)).status()).toBe(404);

    const selfEdge = await request.post('/api/edges', { data: { ...edgePayload, dst: source, type: 'Invalid self edge' } });
    expect(selfEdge.status()).toBe(400);
  } finally {
    await request.delete(`/api/memories/${source}`);
    await request.delete(`/api/memories/${target}`);
  }
});
