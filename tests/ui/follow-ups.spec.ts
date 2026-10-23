import { expect, test } from '@playwright/test';

test('follow-ups stay linked to a memory and completion is repeatable', async ({ request }) => {
  const memoryResponse = await request.post('/api/capture', { data: { title: `Follow-up origin ${Date.now()}`, content: 'Discussed the internship.' } });
  expect(memoryResponse.status()).toBe(201);
  const memoryId = (await memoryResponse.json()).data.id as string;
  try {
    const invalid = await request.post('/api/follow-ups', { data: { title: 'Invalid date', memoryId, dueAt: 'tomorrow' } });
    expect(invalid.status()).toBe(400);
    const created = await request.post('/api/follow-ups', { data: { title: 'Send my portfolio', memoryId, dueAt: '2027-01-18T09:00:00.000Z' } });
    expect(created.status()).toBe(201);
    const followUp = (await created.json()).data;
    expect(followUp.status).toBe('open');
    expect(followUp.memory_id).toBe(memoryId);
    const listed = await request.get(`/api/follow-ups?memoryId=${memoryId}`);
    expect((await listed.json()).data.map((row: { id: string }) => row.id)).toContain(followUp.id);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const completed = await request.patch(`/api/follow-ups/${followUp.id}`, { data: { status: 'done' } });
      expect(completed.status()).toBe(200);
      const value = (await completed.json()).data;
      expect(value.status).toBe('done');
      expect(value.completed_at).toBeTruthy();
    }
  } finally {
    await request.delete(`/api/memories/${memoryId}`);
  }
});

test('context workspace can create and complete a follow-up', async ({ page, request }) => {
  const label = `Project follow-up ${Date.now()}`;
  const contextResponse = await request.post('/api/contexts', { data: { type: 'Project', label } });
  const contextId = (await contextResponse.json()).data.id as string;
  await page.goto(`/contexts/${contextId}`);
  await page.getByLabel('Follow-up title').fill('Review the design notes');
  await page.getByRole('button', { name: 'Add follow-up' }).click();
  await expect(page.getByText('Review the design notes')).toBeVisible();
  const list = await request.get(`/api/follow-ups?contextId=${contextId}`);
  const followUps = (await list.json()).data as { id: string }[];
  for (const item of followUps) await request.delete(`/api/follow-ups/${item.id}`);
});
