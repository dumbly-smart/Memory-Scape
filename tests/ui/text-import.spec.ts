import { expect, test, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function removeImported(request: APIRequestContext, titles: string[]) {
  for (const title of titles) {
    const response = await request.get(`/api/memories?q=${encodeURIComponent(title)}`);
    if (!response.ok()) continue;
    const rows = (await response.json()).data as { id:string; title:string }[];
    for (const row of rows.filter(item=>item.title===title)) await request.delete(`/api/memories/${row.id}`);
  }
}

test('preview and apply Markdown, Netscape bookmarks, and iCalendar without duplicate rows', async ({ request }) => {
  const nonce = randomUUID();
  const titles = [`Imported field note ${nonce}`,`Graph reading ${nonce}`,`ICS seminar ${nonce}`];
  const files = [
    { name: 'notes.md', content: `# ${titles[0]}\n\nRemember the red bridge at sunset.` },
    { name: 'bookmarks.html', content: `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://example.test/${nonce}" ADD_DATE="1700000000">${titles[1]}</A></DL>` },
    { name: 'events.ics', content: `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:${nonce}\r\nSUMMARY:${titles[2]}\r\nDESCRIPTION:Discussed relational memories\r\nDTSTART:20241012T093000Z\r\nEND:VEVENT\r\nEND:VCALENDAR` },
  ];
  try {
    const preview = await request.post('/api/import/text', { data: { action: 'preview', files } });
    expect(preview.status()).toBe(200);
    const previewBody = (await preview.json()).data;
    expect(previewBody.items).toHaveLength(3);
    expect(previewBody.duplicates).toBe(0);
    const applied = await request.post('/api/import/text', { data: { action: 'apply', files } });
    expect(applied.status()).toBe(200);
    expect((await applied.json()).data).toMatchObject({ inserted: 3, skipped: 0 });
    const duplicatePreview = await request.post('/api/import/text', { data: { action: 'preview', files } });
    expect((await duplicatePreview.json()).data.duplicates).toBe(3);
    const duplicateApply = await request.post('/api/import/text', { data: { action: 'apply', files } });
    expect((await duplicateApply.json()).data).toMatchObject({ inserted: 0, skipped: 3 });
  } finally { await removeImported(request,titles); }
});

test('import page previews and applies a selected file', async ({ page, request }) => {
  const title = `UI import ${randomUUID()}`;
  try {
    await page.goto('/settings/import');
    await page.locator('input[type=file]').setInputFiles({ name:'note.md',mimeType:'text/markdown',buffer:Buffer.from(`# ${title}\n\nSaved through the import interface.`) });
    await page.getByRole('button',{name:'Preview import'}).click();
    await expect(page.getByRole('cell',{name:title,exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Import 1 new entries'}).click();
    await expect(page.getByRole('status')).toContainText('Imported 1 entries');
  } finally { await removeImported(request,[title]); }
});
