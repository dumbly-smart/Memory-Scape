import { expect, test } from '@playwright/test';

test('algorithm coefficients are persisted through validated settings', async ({ request, page }) => {
  const beforeResponse = await request.get('/api/settings/algorithms');
  expect(beforeResponse.ok()).toBeTruthy();
  const before = (await beforeResponse.json()).data as Record<string, number>;
  const invalid = await request.put('/api/settings/algorithms', { data: { ...before, valenceBase: 0.7, valenceSalience: 0.4 } });
  expect(invalid.status()).toBe(400);
  try {
    await page.goto('/settings');
    await page.getByLabel('Valence base coefficient').fill('0.6');
    await page.getByLabel('Valence salience coefficient').fill('0.4');
    await page.getByLabel('Review strength weight').fill('0.6');
    await page.getByLabel('Review age weight').fill('0.4');
    await page.getByLabel('Review age cap in days').fill('30');
    await page.getByRole('button', { name: 'Save algorithm parameters' }).click();
    await expect(page.getByRole('status')).toContainText('Saved');
    const after = (await (await request.get('/api/settings/algorithms')).json()).data;
    expect(after.valenceBase).toBe(0.6);
    expect(after.valenceSalience).toBe(0.4);
  } finally {
    const restore = await request.put('/api/settings/algorithms', { data: before });
    expect(restore.ok()).toBeTruthy();
  }
});
