import { expect, test } from '@playwright/test';

test('nearby recall uses PostGIS distance and filters sensitive and archived memories', async ({ request }) => {
  const marker = `Nearby fixture ${Date.now()}`;
  const memoryResponse = await request.post('/api/memories', { data: { title: marker, content: 'At the library', occurredAt: new Date().toISOString(), latitude: 13.0100, longitude: 77.5500, locationLabel: 'Library', isSensitive: false } });
  expect(memoryResponse.status()).toBe(201);
  const memoryId = (await memoryResponse.json()).data.id as string;
  const sensitiveResponse = await request.post('/api/memories', { data: { title: `${marker} sensitive`, content: 'Private', occurredAt: new Date().toISOString(), latitude: 13.0100, longitude: 77.5500, isSensitive: true } });
  const sensitiveId = (await sensitiveResponse.json()).data.id as string;
  const archivedResponse = await request.post('/api/memories', { data: { title: `${marker} archived`, content: 'Archived', occurredAt: new Date().toISOString(), latitude: 13.0100, longitude: 77.5500 } });
  const archivedId = (await archivedResponse.json()).data.id as string;
  await request.patch(`/api/memories/${archivedId}`, { data: { archivedAt: new Date().toISOString() } });
  let reminderId = '';
  try {
    const created = await request.post('/api/place-reminders', { data: { title: 'Check the borrowed book', memoryId, latitude: 13.0100, longitude: 77.5500, radiusMeters: 300, locationLabel: 'Library' } });
    expect(created.status()).toBe(201);
    reminderId = (await created.json()).data.id as string;
    const nearby = await request.get('/api/places/nearby?latitude=13.0101&longitude=77.5500&radiusMeters=1000');
    expect(nearby.status()).toBe(200);
    const rows = (await nearby.json()).data as { id: string; kind: string; distance_m: number; title: string }[];
    expect(rows.some(row => row.kind === 'memory' && row.id === memoryId)).toBe(true);
    expect(rows.some(row => row.kind === 'reminder' && row.id === reminderId)).toBe(true);
    expect(rows.some(row => row.id === sensitiveId || row.id === archivedId)).toBe(false);
    expect(rows.every(row => row.distance_m >= 0)).toBe(true);
    expect((await request.get('/api/places/nearby?latitude=999&longitude=77&radiusMeters=100')).status()).toBe(400);
  } finally {
    if (reminderId) await request.delete(`/api/place-reminders/${reminderId}`);
    await request.delete(`/api/memories/${memoryId}`);
    await request.delete(`/api/memories/${sensitiveId}`);
    await request.delete(`/api/memories/${archivedId}`);
  }
});

test('nearby page requests location only after the user activates it', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 13.0101, longitude: 77.55, accuracy: 5, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) }, timestamp: Date.now(), toJSON: () => ({}) }) } });
  });
  await page.goto('/nearby');
  await expect(page.getByRole('button', { name: 'What’s relevant here?' })).toBeVisible();
  await page.getByRole('button', { name: 'What’s relevant here?' }).click();
  await expect(page.getByText(/Nearby results/)).toBeVisible();
});
