import { expect, test, type APIRequestContext } from '@playwright/test';

async function createMemory(request: APIRequestContext, title: string, occurredAt: string, coordinates?: { latitude: number; longitude: number }, strength = 1) {
  const response = await request.post('/api/memories', { data: {
    title,
    content: 'Deterministic research recall fixture.',
    occurredAt,
    strength,
    ...(coordinates ?? {}),
  } });
  expect(response.status()).toBe(201);
  return (await response.json()).data.id as string;
}

test('spatiotemporal SQL recall intersects route distance with a half-open event interval', async ({ request }) => {
  const near = await createMemory(request, `ST near ${Date.now()}`, '2025-01-01T12:30:00.000Z', { latitude: 37, longitude: -121.995 });
  const atEnd = await createMemory(request, `ST end ${Date.now()}`, '2025-01-01T14:00:00.000Z', { latitude: 37, longitude: -121.997 });
  const offRoute = await createMemory(request, `ST far ${Date.now()}`, '2025-01-01T12:20:00.000Z', { latitude: 37.01, longitude: -121.995 });
  try {
    const response = await request.post('/api/spatiotemporal/walk', { data: {
      route: { type: 'LineString', coordinates: [[-122, 37], [-121.99, 37]] },
      radiusMeters: 100,
      from: '2025-01-01T12:00:00.000Z',
      until: '2025-01-01T14:00:00.000Z',
    } });
    expect(response.status()).toBe(200);
    const rows = (await response.json()).data as Array<{ memory_id: string }>;
    expect(rows.map(row => row.memory_id)).toContain(near);
    expect(rows.map(row => row.memory_id)).not.toContain(atEnd);
    expect(rows.map(row => row.memory_id)).not.toContain(offRoute);
  } finally {
    for (const id of [near, atEnd, offRoute]) await request.delete(`/api/memories/${id}`);
  }
});

test('associative path endpoint returns ranked alternative SQL paths with explainable score steps', async ({ page, request }) => {
  const stamp = Date.now();
  const ids = await Promise.all([
    createMemory(request, `Research seed ${stamp}`, '2025-01-01T12:00:00.000Z'),
    createMemory(request, `Research strong ${stamp}`, '2025-01-01T12:01:00.000Z', undefined, 0.8),
    createMemory(request, `Research alternate ${stamp}`, '2025-01-01T12:02:00.000Z', undefined, 0.8),
    createMemory(request, `Research target ${stamp}`, '2025-01-01T12:03:00.000Z', undefined, 0.9),
  ]);
  try {
    const edges = [
      [ids[0], ids[1], 'strong-a', 0.8], [ids[1], ids[3], 'strong-b', 0.8],
      [ids[0], ids[2], 'weak-a', 0.5], [ids[2], ids[3], 'weak-b', 0.9],
      [ids[3], ids[0], 'cycle', 1],
    ] as const;
    for (const [src, dst, type, weight] of edges) {
      const edge = await request.post('/api/edges', { data: { src, dst, type, weight, valence: 0 } });
      expect(edge.status()).toBe(201);
    }
    const response = await request.post('/api/associative/paths', { data: { seedId: ids[0], targetId: ids[3], depth: 3, threshold: 0.001, limit: 5 } });
    expect(response.status()).toBe(200);
    const paths = (await response.json()).data as Array<{ activation: number; path_ids: string[]; step_activations: number[] }>;
    const coefficientResponse = await request.get('/api/settings/algorithms');
    const valenceBase = Number((await coefficientResponse.json()).data.valenceBase);
    const strongestActivation = 0.4608 * valenceBase ** 2;
    const alternateActivation = 0.324 * valenceBase ** 2;
    expect(paths).toHaveLength(2);
    expect(paths[0].activation).toBeCloseTo(strongestActivation, 5);
    expect(paths[1].activation).toBeCloseTo(alternateActivation, 5);
    expect(paths[0].path_ids).toEqual([ids[0], ids[1], ids[3]]);
    expect(paths[1].path_ids).toEqual([ids[0], ids[2], ids[3]]);
    expect(paths[0].step_activations[0]).toBe(1);
    expect(paths[0].step_activations[1]).toBeCloseTo(0.64 * valenceBase, 5);
    expect(paths[0].step_activations[2]).toBeCloseTo(strongestActivation, 5);
    for (const path of paths) expect(new Set(path.path_ids).size).toBe(path.path_ids.length);
    await page.goto('/graph');
    await page.getByLabel('Hops').selectOption('3');
    await page.getByLabel('Seed memory').selectOption({ label: `Research seed ${stamp}` });
    await page.getByRole('button', { name: 'Spread activation' }).click();
    const targetCard = page.locator('.result-card').filter({ hasText: `Research target ${stamp}` });
    await targetCard.getByRole('button', { name: 'Inspect alternate paths' }).click();
    await expect(page.getByLabel('Alternate activation paths')).toContainText('Path 1');
    await expect(page.getByLabel('Alternate activation paths')).toContainText('Path 2');
  } finally {
    for (const id of ids) await request.delete(`/api/memories/${id}`);
  }
});

test('spatiotemporal recall page draws a route and applies its event-time window', async ({ page, request }) => {
  const now = Date.now();
  const id = await createMemory(request, `Research UI route ${now}`, new Date(now).toISOString(), { latitude: 13.021, longitude: 77.568 });
  try {
    await page.goto('/research/spatiotemporal');
    const map = page.locator('.leaflet-container');
    const bounds = await map.boundingBox();
    if (!bounds) throw new Error('Research map has no visible bounds');
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.click(bounds.x + bounds.width / 2 + 12, bounds.y + bounds.height / 2);
    // WebKit can render this responsive map with a click center offset from
    // the configured geographic center. Keep the UI fixture inside the route
    // corridor; route filtering itself is asserted with exact radii at the API.
    await page.locator('#st-radius').press('End');
    const from = new Date(now - 86400000).toISOString().slice(0, 16);
    const until = new Date(now + 86400000).toISOString().slice(0, 16);
    await page.getByLabel('Event time from').fill(from);
    await page.getByLabel('Event time until (exclusive)').fill(until);
    await page.getByRole('button', { name: 'Run spatiotemporal recall' }).click();
    await expect(page.locator('.result-card').filter({ hasText: `Research UI route ${now}` })).toBeVisible();
    await expect(page.getByText(/Route ordered · event interval/)).toBeVisible();
  } finally {
    await request.delete(`/api/memories/${id}`);
  }
});

test('research endpoints reject invalid time ranges, path limits, and malformed IDs', async ({ request }) => {
  const spatiotemporal = await request.post('/api/spatiotemporal/walk', { data: {
    route: { type: 'LineString', coordinates: [[-122, 37], [-121.99, 37]] },
    radiusMeters: 100, from: '2025-01-02T00:00:00.000Z', until: '2025-01-01T00:00:00.000Z',
  } });
  expect(spatiotemporal.status()).toBe(400);
  const paths = await request.post('/api/associative/paths', { data: {
    seedId: 'not-a-uuid', targetId: 'not-a-uuid', depth: 3, threshold: 0.01, limit: 51,
  } });
  expect(paths.status()).toBe(400);
});
