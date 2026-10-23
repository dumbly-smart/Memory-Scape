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


test('malformed import batches fail with a client error before any memory is written',async({request})=>{
  const title=`Must not import ${randomUUID()}`;
  const response=await request.post('/api/import/text',{data:{action:'apply',files:[{name:'valid.md',content:`# ${title}

Valid entry.`},{name:'broken.ics',content:'BEGIN:VCALENDAR\nEND:VCALENDAR'}]}});
  expect(response.status()).toBe(400);
  const search=await request.get(`/api/memories?q=${encodeURIComponent(title)}`);
  expect((await search.json()).data).toHaveLength(0);
});


test('text import enforces the documented total payload limit',async({request})=>{
  const response=await request.post('/api/import/text',{data:{action:'preview',files:[{name:'large.md',content:'x'.repeat(15*1024*1024+1)}]}});
  expect(response.status()).toBe(413);
});


test('duplicate items within a selected batch are reported and inserted once',async({request})=>{
  const title='Repeated batch note '+randomUUID();
  const content=['# '+title,'','The same entry appears twice.'].join(String.fromCharCode(10));
  try {
    const files=[{name:'first.md',content},{name:'copy.md',content}];
    const preview=await request.post('/api/import/text',{data:{action:'preview',files}});
    expect((await preview.json()).data).toMatchObject({total:2,duplicates:1,newEntries:1});
    const applied=await request.post('/api/import/text',{data:{action:'apply',files}});
    expect((await applied.json()).data).toMatchObject({inserted:1,skipped:1,total:2});
  } finally {
    const found=await request.get('/api/memories?q='+encodeURIComponent('Repeated batch note'));
    if(found.ok())for(const row of (await found.json()).data as {id:string;title:string}[])if(row.title.startsWith(title))await request.delete('/api/memories/'+row.id);
  }
});
