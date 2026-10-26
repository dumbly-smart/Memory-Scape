import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

test('indexes searchable and scanned PDFs for ordinary memory search', async ({ page, request }) => {
  const title = `PDF attachment ${Date.now()}`;
  const created = await request.post('/api/memories', { data: { title, content: '', occurredAt: new Date().toISOString() } });
  expect(created.status()).toBe(201);
  const memoryId = (await created.json()).data.id as string;
  try {
    const searchablePdf = await readFile(resolve(process.cwd(), 'tests/fixtures/searchable-text.pdf'));
    const textUpload = await request.post(`/api/memories/${memoryId}/attachments`, {
      multipart: { file: { name: 'lecture.pdf', mimeType: 'application/pdf', buffer: searchablePdf } },
    });
    expect(textUpload.status()).toBe(201);
    expect((await textUpload.json()).data.searchable).toBe(true);
    const textSearch = await request.get('/api/memories?q=Searchable%20campus%20PDF%20phrase');
    expect((await textSearch.json()).data.some((row: { id: string }) => row.id === memoryId)).toBe(true);

    const scannedPdf = await readFile(resolve(process.cwd(), 'tests/fixtures/scanned-text.pdf'));
    const ocrUpload = await request.post(`/api/memories/${memoryId}/attachments`, {
      multipart: { file: { name: 'scanned-notes.pdf', mimeType: 'application/pdf', buffer: scannedPdf } },
    });
    expect(ocrUpload.status()).toBe(201);
    expect((await ocrUpload.json()).data.searchable).toBe(true);
    const ocrSearch = await request.get('/api/memories?q=CAMPUS%20MEMORY');
    expect((await ocrSearch.json()).data.some((row: { id: string }) => row.id === memoryId)).toBe(true);

    await page.goto('/memories');
    await page.getByRole('button', { name: title }).click();
    await expect(page.getByText('Searchable text indexed').last()).toBeVisible();
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
