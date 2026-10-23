import { expect, test } from '@playwright/test';

test('workspace backup supports dry-run then atomic import and refuses collisions', async ({ request }) => {
  const memoryId = '7734d10c-a8ae-4fc1-9202-d64651183122';
  const bundle = {
    format: 'memoryscape-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    memories: [{ id: memoryId, title: 'Imported memory', content: 'Backup fixture', occurred_at: new Date().toISOString(), latitude: 12.97, longitude: 77.59, location_label: 'Campus', strength: 0.8, decay_rate: 0.01, last_strength_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), source_url: null, source_title: null, is_pinned: false, is_sensitive: false, archived_at: null }],
    contexts: [],
    memoryContexts: [],
    memoryEdges: [], reinforcements: [], followUps: [], decisions: [], attachments: [], placeReminders: [], reviewActions: [],
  };
  try {
    const preview = await request.post('/api/backup/import', { data: bundle });
    expect(preview.status()).toBe(200);
    expect((await preview.json()).data.applied).toBe(false);
    const imported = await request.post('/api/backup/import', { data: { ...bundle, apply: true } });
    expect(imported.status()).toBe(201);
    const memory = await request.get(`/api/memories/${memoryId}`);
    expect(memory.status()).toBe(200);
    expect((await memory.json()).data.title).toBe('Imported memory');
    const collision = await request.post('/api/backup/import', { data: { ...bundle, apply: true } });
    expect(collision.status()).toBe(409);
  } finally {
    await request.delete(`/api/memories/${memoryId}`);
  }
});

test('backup export is versioned and carries entity collections', async ({ request }) => {
  const response = await request.get('/api/backup/export');
  expect(response.status()).toBe(200);
  const value = await response.json();
  expect(value.version).toBe(1);
  expect(value).toHaveProperty('memories');
  expect(value).toHaveProperty('attachments');
  expect(value).toHaveProperty('placeReminders');
});
