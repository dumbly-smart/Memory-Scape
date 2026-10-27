import { expect, test } from '@playwright/test';

test('database returns bounded, explained graph around selected seed and excludes private nodes', async ({ request }) => {
  const suffix = Date.now();
  const create = async (title: string, isSensitive = false) => {
    const response = await request.post('/api/memories', { data: { title: `${title} ${suffix}`, content: '', occurredAt: new Date().toISOString(), isSensitive, strength: 1, decayRate: 0 } });
    expect(response.status()).toBe(201);
    return (await response.json()).data.id as string;
  };
  const ids = [await create('Seed'), await create('One hop'), await create('Two hops'), await create('Private', true)];
  try {
    for (const [src, dst, type] of [[ids[0], ids[1], 'direct'], [ids[1], ids[2], 'next'], [ids[2], ids[0], 'cycle'], [ids[0], ids[3], 'private']]) {
      const edge = await request.post('/api/edges', { data: { src, dst, type, weight: 1, valence: -0.8 } });
      expect(edge.status()).toBe(201);
    }
    const response = await request.post('/api/associative/subgraph', { data: { seedId: ids[0], depth: 3, threshold: 0, limit: 1 } });
    expect(response.status()).toBe(200);
    const data = (await response.json()).data as { seed: { id: string }; nodes: { memory_id: string; hop_depth: number; path_ids: string[]; edge_types: string[]; edge_valences: number[] }[]; edges: { src: string; dst: string }[]; limits: { nodes: number } };
    expect(data.seed.id).toBe(ids[0]);
    expect(data.nodes).toHaveLength(1);
    expect(data.nodes[0].memory_id).toBe(ids[1]);
    expect(data.nodes[0].path_ids).toEqual([ids[0], ids[1]]);
    expect(data.nodes[0].edge_types).toEqual(['direct']);
    expect(data.nodes[0].edge_valences).toEqual([-0.8]);
    expect(data.edges.some(edge => edge.dst === ids[3])).toBe(false);
    expect(data.limits.nodes).toBe(1);
  } finally { await Promise.all(ids.map(memoryId => request.delete(`/api/memories/${memoryId}`))); }
});

test('graph page can start an exploration from a chosen memory', async ({ page, request }) => {
  const created = await request.post('/api/memories', { data: { title: `Graph page seed ${Date.now()}`, content: '', occurredAt: new Date().toISOString(), strength: 1, decayRate: 0 } });
  expect(created.status()).toBe(201);
  const seed = (await created.json()).data as { id: string; title: string };
  try {
    await page.goto('/graph');
    await page.getByLabel('Seed memory').selectOption(seed.id);
    await page.getByRole('button', { name: 'Spread activation' }).click();
    await expect(page.getByRole('heading', { name: 'Strongest activations' })).toBeVisible();
    await expect(page.getByText('No memories passed this threshold. Lower the pruning value or choose another seed.')).toBeVisible();
  } finally { await request.delete(`/api/memories/${seed.id}`); }
});

test('graph page inspects an activated memory before deliberately recentering', async ({ page, request }) => {
  const suffix = Date.now();
  const create = async (title: string) => {
    const response = await request.post('/api/memories', { data: { title: `${title} ${suffix}`, content: 'A synthetic graph interaction fixture.', occurredAt: new Date().toISOString(), strength: 1, decayRate: 0 } });
    expect(response.status()).toBe(201);
    return (await response.json()).data as { id: string; title: string };
  };
  const seed = await create('Network seed');
  const neighbor = await create('Network neighbor');
  try {
    const edge = await request.post('/api/edges', { data: { src: seed.id, dst: neighbor.id, type: 'Reminds me of', weight: 0.9, valence: 0.7 } });
    expect(edge.status()).toBe(201);
    await page.goto('/graph');
    await page.getByLabel('Seed memory').selectOption(seed.id);
    await page.getByRole('button', { name: 'Spread activation' }).click();

    const inspect = page.getByRole('button', { name: `Inspect ${neighbor.title}` });
    await expect(inspect).toBeVisible();
    await inspect.click();
    const selected = page.getByRole('region', { name: 'Selected memory' });
    await expect(selected).toContainText(neighbor.title);
    await expect(selected).toContainText('Reminds me of');

    await selected.getByRole('button', { name: 'Explore from this memory' }).click();
    await expect(page.getByText(`Current seed · ${neighbor.title}`)).toBeVisible();
  } finally {
    await Promise.all([request.delete(`/api/memories/${seed.id}`), request.delete(`/api/memories/${neighbor.id}`)]);
  }
});
