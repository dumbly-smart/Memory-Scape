import { expect, test } from '@playwright/test';

test('weekly review groups eligible items and persists snooze and archive actions', async ({ request }) => {
  const suffix = Date.now();
  const eligibleResponse = await request.post('/api/memories', { data: { title: `Weekly pinned ${suffix}`, content: 'Important memory', occurredAt: new Date().toISOString(), isPinned: true } });
  const eligibleId = (await eligibleResponse.json()).data.id as string;
  const sensitiveResponse = await request.post('/api/memories', { data: { title: `Weekly private ${suffix}`, content: 'Private memory', occurredAt: new Date().toISOString(), isPinned: true, isSensitive: true } });
  const sensitiveId = (await sensitiveResponse.json()).data.id as string;
  const followUpResponse = await request.post('/api/follow-ups', { data: { title: `Due follow-up ${suffix}`, memoryId: eligibleId, dueAt: new Date(Date.now() - 86400000).toISOString() } });
  const followUpId = (await followUpResponse.json()).data.id as string;
  try {
    const response = await request.get('/api/review/weekly');
    expect(response.status()).toBe(200);
    const items = (await response.json()).data as { kind: string; id: string; title: string }[];
    expect(items.some(item => item.kind === 'memory' && item.id === eligibleId)).toBe(true);
    expect(items.some(item => item.kind === 'follow_up' && item.id === followUpId)).toBe(true);
    expect(items.some(item => item.id === sensitiveId)).toBe(false);

    const snoozed = await request.post('/api/review/weekly/action', { data: { kind: 'follow_up', id: followUpId, action: 'snooze', snoozeDays: 7 } });
    expect(snoozed.status()).toBe(200);
    const afterSnooze = (await (await request.get('/api/review/weekly')).json()).data as { id: string }[];
    expect(afterSnooze.some(item => item.id === followUpId)).toBe(false);

    const archived = await request.post('/api/review/weekly/action', { data: { kind: 'memory', id: eligibleId, action: 'archive' } });
    expect(archived.status()).toBe(200);
    expect((await (await request.get(`/api/memories/${eligibleId}`)).json()).data.archived_at).toBeTruthy();
  } finally {
    await request.delete(`/api/follow-ups/${followUpId}`);
    await request.delete(`/api/memories/${eligibleId}`);
    await request.delete(`/api/memories/${sensitiveId}`);
  }
});

test('weekly review page exposes explicit keep, snooze, archive, and dismiss actions', async ({ page, request }) => {
  const created = await request.post('/api/memories', { data: { title: `Weekly UI ${Date.now()}`, content: 'Review fixture', occurredAt: new Date().toISOString(), isPinned: true } });
  expect(created.status()).toBe(201);
  const memoryId = (await created.json()).data.id as string;
  try {
    await page.goto('/review/weekly');
    await expect(page.getByRole('heading', { name: 'Weekly review' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Snooze' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archive' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' }).first()).toBeVisible();
  } finally {
    await request.delete(`/api/memories/${memoryId}`);
  }
});

test('weekly review shows one card and a right swipe keeps it before advancing', async ({ page, request }) => {
  const created = await request.post('/api/memories', { data: { title: `Swipe review ${Date.now()}`, content: 'Swipe interaction fixture', occurredAt: new Date().toISOString(), isPinned: true } });
  expect(created.status()).toBe(201);
  const memoryId = (await created.json()).data.id as string;
  try {
    const response = await request.get('/api/review/weekly');
    const queue = (await response.json()).data as { kind: 'memory'|'follow_up'; id: string; title: string }[];
    expect(queue.length).toBeGreaterThan(1);
    await page.goto('/review/weekly');

    const card = page.getByTestId('weekly-card');
    await expect(card).toHaveCount(1);
    await expect(card.getByRole('heading', { level: 2 })).toHaveText(queue[0].title);
    await expect(page.getByTestId('weekly-progress')).toHaveText(`Review 1 of ${queue.length}`);

    const bounds = await card.boundingBox();
    if (!bounds) throw new Error('Weekly review card is not laid out');
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 190, y, { steps: 8 });
    await page.mouse.up();

    await expect(page.getByRole('status')).toContainText('kept');
    await expect(card.getByRole('heading', { level: 2 })).toHaveText(queue[1].title);
    await expect(page.getByTestId('weekly-progress')).toHaveText(`Review 2 of ${queue.length}`);
  } finally {
    await request.delete(`/api/memories/${memoryId}`);
  }
});

test('weekly review archives the current memory on a left swipe', async ({ page, request }) => {
  const created = await request.post('/api/memories', { data: { title: `Archive swipe ${Date.now()}`, content: 'Archive swipe fixture', occurredAt: new Date().toISOString(), isPinned: true } });
  expect(created.status()).toBe(201);
  const memory = (await created.json()).data as { id: string; title: string };
  try {
    const queue = (await (await request.get('/api/review/weekly')).json()).data as { kind: string; id: string; title: string }[];
    expect(queue[0]?.id).toBe(memory.id);
    await page.goto('/review/weekly');
    const card = page.getByTestId('weekly-card');
    await expect(card.getByRole('heading', { level: 2 })).toHaveText(memory.title);
    const bounds = await card.boundingBox();
    if (!bounds) throw new Error('Weekly review card is not laid out');
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 190, y, { steps: 8 });
    await page.mouse.up();

    await expect(page.getByRole('status')).toContainText('archived');
    await expect(card.getByRole('heading', { level: 2 })).toHaveText(queue[1].title);
    const archived = (await (await request.get(`/api/memories/${memory.id}`)).json()).data;
    expect(archived.archived_at).toBeTruthy();
  } finally {
    await request.delete(`/api/memories/${memory.id}`);
  }
});
