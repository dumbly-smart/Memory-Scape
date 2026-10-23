import { expect, test } from '@playwright/test';

test('decision records retain rationale, alternatives, and revisit dates', async ({ request }) => {
  const contextResponse = await request.post('/api/contexts', { data: { type: 'Project', label: `Decision project ${Date.now()}` } });
  const contextId = (await contextResponse.json()).data.id as string;
  const tooEarly = await request.post('/api/decisions', { data: { choice: 'Use a queue', rationale: 'Avoid blocking requests', alternatives: 'Run inline', decidedAt: '2027-04-10T00:00:00.000Z', revisitAt: '2027-04-01T00:00:00.000Z', contextId } });
  expect(tooEarly.status()).toBe(400);
  const created = await request.post('/api/decisions', { data: { choice: 'Use a queue', rationale: 'Avoid blocking requests', alternatives: 'Run inline', decidedAt: '2027-04-10T00:00:00.000Z', revisitAt: '2027-06-10T00:00:00.000Z', contextId } });
  expect(created.status()).toBe(201);
  const decision = (await created.json()).data;
  expect(decision.choice).toBe('Use a queue');
  expect(decision.context_id).toBe(contextId);
  const list = await request.get(`/api/decisions?contextId=${contextId}`);
  expect((await list.json()).data[0].rationale).toBe('Avoid blocking requests');
  await request.delete(`/api/decisions/${decision.id}`);
});

test('project workspace creates a decision record', async ({ page, request }) => {
  const label = `Decision UI ${Date.now()}`;
  const contextResponse = await request.post('/api/contexts', { data: { type: 'Project', label } });
  const contextId = (await contextResponse.json()).data.id as string;
  await page.goto(`/contexts/${contextId}`);
  await page.getByLabel('Decision choice').fill('Keep the database as the source of truth');
  await page.getByLabel('Decision rationale').fill('Transactional updates belong there.');
  await page.getByRole('button', { name: 'Save decision' }).click();
  await expect(page.getByText('Keep the database as the source of truth')).toBeVisible();
  const list = await request.get(`/api/decisions?contextId=${contextId}`);
  const rows = (await list.json()).data as { id: string }[];
  for (const row of rows) await request.delete(`/api/decisions/${row.id}`);
});
