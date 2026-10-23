import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('daily brief surfaces overdue follow-ups linked to a memory', async ({ request, page }) => {
  const capture = await request.post('/api/capture', { data: { content: `Daily brief fixture ${randomUUID()}` } });
  expect(capture.status()).toBe(201);
  const memoryId = (await capture.json()).data.id as string;
  try {
    const followUp = await request.post('/api/follow-ups', { data: { title: 'Review the field notes', description: 'A due item for the daily brief', dueAt: '2020-01-01T00:00:00.000Z', memoryId } });
    expect(followUp.status()).toBe(201);
    const response = await request.get('/api/daily');
    expect(response.status()).toBe(200);
    expect((await response.json()).data.dueFollowUps.some((row: { title: string }) => row.title === 'Review the field notes')).toBe(true);
    await page.goto('/daily');
    await expect(page.getByRole('heading', { name: 'Today, in context' })).toBeVisible();
    await expect(page.getByText('Review the field notes')).toBeVisible();
    await expect(page.getByRole('button', { name: /Enable daily notifications/ })).toBeVisible();
  } finally {
    await request.delete(`/api/memories/${memoryId}`);
  }
});
