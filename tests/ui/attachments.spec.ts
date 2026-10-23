import { expect, test } from '@playwright/test';

test('uploads a text attachment, searches its extracted text, downloads safely, and deletes it', async ({ request }) => {
  const title = `Attachment memory ${Date.now()}`;
  const memoryResponse = await request.post('/api/memories', { data: { title, content: 'Receipt from the market', occurredAt: new Date().toISOString() } });
  expect(memoryResponse.status()).toBe(201);
  const memoryId = (await memoryResponse.json()).data.id as string;
  try {
    const content = Buffer.from('Project codename is Olive Harbor.');
    const upload = await request.post(`/api/memories/${memoryId}/attachments`, { multipart: { file: { name: '../notes.txt', mimeType: 'text/plain', buffer: content } } });
    expect(upload.status()).toBe(201);
    const attachment = (await upload.json()).data;
    expect(attachment.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(attachment.size_bytes).toBe(content.length);
    expect(attachment.file_name).toBe('.._notes.txt');

    const search = await request.get('/api/memories?q=Olive%20Harbor');
    expect((await search.json()).data.some((row: { id: string }) => row.id === memoryId)).toBe(true);

    const download = await request.get(`/api/attachments/${attachment.id}`);
    expect(download.status()).toBe(200);
    expect(download.headers()['content-disposition']).toContain('attachment');
    expect(download.headers()['content-disposition']).toContain('.._notes.txt');
    expect(await download.body()).toEqual(content);
    expect((await request.delete(`/api/attachments/${attachment.id}`)).status()).toBe(200);
  } finally {
    await request.delete(`/api/memories/${memoryId}`);
  }
});

test('rejects an attachment larger than ten mebibytes', async ({ request }) => {
  const response = await request.post('/api/memories', { data: { title: `Oversized attachment ${Date.now()}`, content: '', occurredAt: new Date().toISOString() } });
  const memoryId = (await response.json()).data.id as string;
  try {
    const file = Buffer.alloc(10 * 1024 * 1024 + 1, 97);
    const result = await request.post(`/api/memories/${memoryId}/attachments`, { multipart: { file: { name: 'large.txt', mimeType: 'text/plain', buffer: file } } });
    expect(result.status()).toBe(413);
  } finally {
    await request.delete(`/api/memories/${memoryId}`);
  }
});
