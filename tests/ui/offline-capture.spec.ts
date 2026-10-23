import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('retrying an offline capture with the same key creates only one memory', async ({ request }) => {
  const captureKey = randomUUID();
  const payload = { content: 'Queued while offline', occurredAt: new Date().toISOString(), captureKey };
  const first = await request.post('/api/capture', { data: payload });
  expect(first.status()).toBe(201);
  const firstId = (await first.json()).data.id as string;
  try {
    const retry = await request.post('/api/capture', { data: payload });
    expect(retry.status()).toBe(200);
    expect((await retry.json()).data.id).toBe(firstId);
    const matching = await request.get(`/api/memories?q=${encodeURIComponent('Queued while offline')}`);
    expect((await matching.json()).data.filter((row: { id: string }) => row.id === firstId)).toHaveLength(1);
  } finally { await request.delete(`/api/memories/${firstId}`); }
});

test('capture is installable and can queue then sync an offline draft', async ({ page, request }) => {
  const text = `Offline note ${randomUUID()}`;
  await page.goto('/capture');
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe('standalone');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.context().setOffline(true);
  await page.getByLabel('Thought, quote, or note').fill(text);
  await page.getByRole('button', { name: 'Save memory' }).click();
  await expect(page.getByRole('status')).toContainText('Saved on this device; waiting to sync');
  await page.context().setOffline(false);
  await expect(page.getByRole('status')).toContainText('Synced 1 offline capture');
  const found = await request.get(`/api/memories?q=${encodeURIComponent(text)}`);
  expect((await found.json()).data.some((row: { content: string }) => row.content === text)).toBe(true);
});

test('sensitive draft is not written to the unencrypted offline queue', async ({ page }) => {
  await page.goto('/capture');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.context().setOffline(true);
  await page.getByLabel('Thought, quote, or note').fill('Do not persist this sensitive offline note');
  await page.getByLabel('Keep out of review suggestions').check();
  await page.getByRole('button', { name: 'Save memory' }).click();
  await expect(page.locator('.error[role=alert]')).toContainText('Sensitive notes cannot be queued offline');
});
