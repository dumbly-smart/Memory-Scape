import { expect, test, type APIRequestContext } from '@playwright/test';

const apiMemory = async (request: APIRequestContext, title: string, strength = 0.8) => {
  const response = await request.post('/api/memories', { data: {
    title,
    content: 'Browser page workflow fixture.',
    occurredAt: new Date().toISOString(),
    latitude: 13.021,
    longitude: 77.568,
    locationLabel: 'Browser workflow',
    strength,
  } });
  expect(response.status()).toBe(201);
  return (await response.json()).data.id as string;
};

test('map draws and edits a route, shows its corridor, and supports sequential and related recall', async ({ page, request }) => {
  const now = Date.now();
  const title = `Map workflow ${now}`;
  const relatedTitle = `Map related ${now}`;
  const ids: string[] = [];
  try {
    const id = await apiMemory(request, title); ids.push(id);
    const relatedId = await apiMemory(request, relatedTitle); ids.push(relatedId);
    const context = await request.post('/api/contexts', { data: { memoryId: id, type: 'Topic', label: 'Map route context' } });
    expect(context.status()).toBe(201);
    const edge = await request.post('/api/edges', { data: { src: id, dst: relatedId, type: 'Map association', weight: 0.8, valence: 0.3 } });
    expect(edge.status()).toBe(201);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 13.021, longitude: 77.568, accuracy: 15 } as GeolocationCoordinates, timestamp: Date.now() } as GeolocationPosition) } });
    });
    await page.goto('/spatial', { waitUntil: 'domcontentloaded' });
    const map = page.locator('.leaflet-container');
    await expect(map).toBeVisible();
    const bounds = await map.boundingBox();
    if (!bounds) throw new Error('Map has no visible bounds');
    await page.getByRole('button', { name: 'Start route at my location' }).click();
    await page.mouse.click(bounds.x + bounds.width / 2 + 70, bounds.y + bounds.height / 2);
    await expect(page.getByRole('button', { name: 'Undo last point' })).toBeEnabled();
    await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(2);
    const radius = page.getByRole('slider', { name: /Corridor radius/ });
    await radius.focus();
    for (let step = 0; step < 4; step += 1) await radius.press('ArrowRight');
    await expect(radius).toHaveValue('250');
    const [walkResponse] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/api/spatial/walk'),
      page.getByRole('button', { name: 'Run spatial memory walk' }).click(),
    ]);
    const walkPayload = await walkResponse.json() as { data: Array<{ memory_id: string }> };
    expect(walkResponse.ok(), `Spatial walk returned ${walkResponse.status()} for ${JSON.stringify(walkResponse.request().postDataJSON())}`).toBeTruthy();
    expect(
      walkPayload.data.some(memory => memory.memory_id === id),
      `Spatial walk omitted the fixture for route ${JSON.stringify(walkResponse.request().postDataJSON())}; returned ${JSON.stringify(walkPayload.data)}`,
    ).toBe(true);
    const result = page.locator('.spatial-result').filter({ hasText: title });
    await expect(result).toBeVisible({ timeout: 20_000 });
    await result.click();
    const details = page.getByLabel('Selected memory details');
    await expect(details).toContainText('Map route context');
    await expect(details).toContainText('Event:');
    await expect(details.getByRole('button', { name: new RegExp(relatedTitle) })).toBeVisible();
    await page.getByRole('button', { name: 'Next →' }).click();
    await expect(details.locator('h3')).not.toHaveText(title);
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(details.locator('h3')).toHaveText(title);
    await details.getByRole('button', { name: new RegExp(relatedTitle) }).click();
    await expect(details.locator('h3')).toHaveText(relatedTitle);
    await page.getByRole('button', { name: 'Undo last point' }).click();
    await page.getByRole('button', { name: 'Clear route' }).click();
    await expect(page.getByText('Draw or start a route to reveal memories around it.')).toBeVisible();
  } finally { for (const id of ids) await request.delete(`/api/memories/${id}`); }
});

test('spatial walk focuses on browser location and can start a route there', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 12.9698, longitude: 79.1559, accuracy: 15 } as GeolocationCoordinates, timestamp: Date.now() } as GeolocationPosition) } });
  });
  await page.goto('/spatial', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('current-location-status')).toContainText('Centered on your current location');
  await expect(page.getByRole('button', { name: 'Start route at my location' })).toBeEnabled();
  await page.getByRole('button', { name: 'Start route at my location' }).click();
  await expect(page.locator('.map-tools')).toContainText('1 vertex');
  await expect(page.locator('.current-location-marker')).toBeVisible();
});

test('timeline filters event dates and reinforces a memory', async ({ page, request }) => {
  const title = `Timeline workflow ${Date.now()}`;
  const id = await apiMemory(request, title, 0.4);
  try {
    await page.goto('/timeline');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByRole('button', { name: '＋ Reinforce' }).first().click();
    await expect(page.getByText('60% strength')).toBeVisible();
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel('From', { exact: true }).fill(today);
    await page.getByLabel('To', { exact: true }).fill(today);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByLabel('From', { exact: true }).fill('2020-01-01');
    await page.getByLabel('To', { exact: true }).fill('2020-01-02');
    await expect(page.getByText('No memories in this date range.')).toBeVisible();
  } finally { await request.delete(`/api/memories/${id}`); }
});

test('graph page runs bounded associative recall from a selected memory', async ({ page, request }) => {
  const now = Date.now();
  const firstTitle = `Graph UI seed ${now}`;
  const secondTitle = `Graph UI target ${now}`;
  const ids: string[] = [];
  try {
    const source = await apiMemory(request, firstTitle); ids.push(source);
    const target = await apiMemory(request, secondTitle); ids.push(target);
    const edge = await request.post('/api/edges', { data: { src: source, dst: target, type: 'UI test link', weight: 0.9, valence: 0.5 } });
    expect(edge.status()).toBe(201);
    await page.goto('/graph');
    await page.getByLabel('Hops').selectOption('1');
    await page.locator('select').first().selectOption({ label: firstTitle });
    await page.getByRole('button', { name: 'Spread activation' }).click();
    await expect(page.locator('.graph-result b').filter({ hasText: secondTitle })).toBeVisible();
    await expect(page.getByText(/1 hops · 0\.\d+ activation/)).toBeVisible();
  } finally { for (const id of ids) await request.delete(`/api/memories/${id}`); }
});

test('review page refreshes the materialized queue and reinforces a fading memory', async ({ page, request }) => {
  await page.goto('/review');
  const refreshResponse=page.waitForResponse(response=>response.url().endsWith('/api/review/refresh')&&response.request().method()==='POST');
  await page.getByRole('button', { name: '↻ Refresh view' }).click();
  await refreshResponse;
  const queue=await request.get('/api/review/fading');
  expect(queue.ok()).toBe(true);
  const first=(await queue.json()).data[0] as {memory_id:string};
  const memoryId=first.memory_id;
  const memoryResponse=await request.get(`/api/memories/${memoryId}`);
  const before=Number((await memoryResponse.json()).data.strength);
  expect(memoryId).toBeTruthy();
  const row = page.locator(`tbody tr[data-memory-id="${memoryId}"]`);
  await expect(row.getByRole('button',{name:'Review + reinforce'})).toBeVisible({timeout:20_000});
  await row.getByRole('button', { name: 'Review + reinforce' }).click();
  await expect(page.getByRole('status')).toContainText('strength updated to');
  const memory = (await (await request.get(`/api/memories/${memoryId}`)).json()).data;
  expect(memory.strength).toBeGreaterThan(before);
  await expect(page.getByRole('status')).toContainText(`${Math.round(memory.strength * 100)}%`);
});
