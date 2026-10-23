import { expect, test } from '@playwright/test';

test('person context page helps resume with recent linked memories', async ({ page, request }) => {
  const label = `Resume person ${Date.now()}`;
  const contextResponse = await request.post('/api/contexts', { data: { type: 'Person', label } });
  expect(contextResponse.status()).toBe(201);
  const contextId = (await contextResponse.json()).data.id as string;
  const memoryResponse = await request.post('/api/capture', { data: { title: `Follow up with ${label}`, content: 'Send the notes we discussed.' } });
  expect(memoryResponse.status()).toBe(201);
  const memoryId = (await memoryResponse.json()).data.id as string;
  try {
    const link = await request.post('/api/contexts', { data: { type: 'Person', label, memoryId } });
    expect((await link.json()).data.inserted).toBe(true);
    await page.goto(`/contexts/${contextId}`);
    await expect(page.getByRole('heading', { name: label })).toBeVisible();
    await expect(page.getByText('Send the notes we discussed.')).toBeVisible();
    await expect(page.getByText('Resume from your most recent memory')).toBeVisible();
  } finally {
    await request.delete(`/api/memories/${memoryId}`);
  }
});

test('context detail API returns 404 for an unknown identifier', async ({ request }) => {
  const response = await request.get('/api/contexts/00000000-0000-4000-8000-000000000001');
  expect(response.status()).toBe(404);
});
