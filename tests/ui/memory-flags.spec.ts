import { expect, test } from '@playwright/test';

test('memory details separate importance, privacy, and archive controls from recall strength', async ({ page, request }) => {
  const title = `Flags ${Date.now()}`;
  const created = await request.post('/api/memories', { data: { title, content: 'Flag controls fixture', occurredAt: new Date().toISOString(), strength: 0.35, decayRate: 0 } });
  expect(created.status()).toBe(201);
  const memoryId = (await created.json()).data.id as string;
  try {
    await page.goto('/memories');
    await page.getByRole('textbox', { name: 'Search memories' }).fill(title);
    await page.getByRole('button', { name: title }).click();
    await page.getByRole('button', { name: 'Pin as important' }).click();
    await page.getByRole('button', { name: 'Mark sensitive' }).click();
    await page.getByRole('button', { name: 'Archive memory' }).click();
    const response = await request.get(`/api/memories/${memoryId}`);
    const memory = (await response.json()).data;
    expect(memory.is_pinned).toBe(true);
    expect(memory.is_sensitive).toBe(true);
    expect(memory.archived_at).toBeTruthy();
    expect(Number(memory.strength)).toBe(0.35);
  } finally { await request.delete(`/api/memories/${memoryId}`); }
});
