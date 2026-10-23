import { expect, test } from '@playwright/test';

test('quick capture saves a thought with its source and privacy controls', async ({ page }) => {
  await page.goto('/capture?url=https%3A%2F%2Fexample.test%2Farticle&title=Research%20article&text=%0AFirst%20useful%20line%0AMore%20detail');
  await expect(page.getByLabel('Thought, quote, or note')).toHaveValue('\nFirst useful line\nMore detail');
  await expect(page.getByLabel('Source URL')).toHaveValue('https://example.test/article');
  await page.getByLabel('Pin as important').check();
  await page.getByLabel('Keep out of review suggestions').check();
  await page.getByRole('button', { name: 'Save memory' }).click();
  await expect(page.getByRole('status')).toContainText('Saved');
  const url = new URL(page.url());
  const created = await page.request.get('/api/memories');
  const payload = await created.json();
  const item = payload.data.find((row: { title: string; source_url: string | null }) => row.title === 'First useful line' && row.source_url === 'https://example.test/article');
  expect(item).toBeTruthy();
  const detail = await page.request.get(`/api/memories/${item.id}`);
  const memory = (await detail.json()).data;
  expect(memory.is_pinned).toBe(true);
  expect(memory.is_sensitive).toBe(true);
  await page.request.delete(`/api/memories/${item.id}`);
  expect(url.pathname).toBe('/capture');
});

test('capture endpoint rejects non-web source URLs', async ({ request }) => {
  const response = await request.post('/api/capture', { data: { content: 'unsafe source', sourceUrl: 'javascript:alert(1)' } });
  expect(response.status()).toBe(400);
});
