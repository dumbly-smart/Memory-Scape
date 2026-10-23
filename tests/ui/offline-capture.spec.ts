import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('retrying an offline capture with the same key creates only one memory', async ({ request }) => {
  const captureKey = randomUUID();
  const payload = { content: 'Queued while offline', occurredAt: new Date().toISOString(), captureKey };
  const first = await request.post('/api/capture', { data: payload });
  expect(first.status()).toBe(201);
  const firstId = (await first.json()).data.id as string;
  try {
    const retry = await request.post('/api/capture', { data: payload });
    expect(retry.status()).toBe(200);
    expect((await retry.json()).data.id).toBe(firstId);
    const matching = await request.get(`/api/memories?q=${encodeURIComponent('Queued while offline')}`);
    expect((await matching.json()).data.filter((row: { id: string }) => row.id === firstId)).toHaveLength(1);
  } finally { await request.delete(`/api/memories/${firstId}`); }
});

test('capture is installable and can queue then sync an offline draft', async ({ page, request }) => {
  const text = `Offline note ${randomUUID()}`;
  await page.goto('/capture');
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe('standalone');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.getByLabel('Local queue passphrase').fill('correct local queue passphrase');
  await page.context().setOffline(true);
  await page.getByLabel('Thought, quote, or note').fill(text);
  await page.getByRole('button', { name: 'Save memory' }).click();
  await expect(page.getByRole('status')).toContainText('Saved on this device; waiting to sync');
  await page.context().setOffline(false);
  await page.getByRole('button', { name: 'Sync encrypted drafts' }).click();
  await expect(page.getByRole('status')).toContainText('Synced 1 offline capture');
  const found = await request.get(`/api/memories?q=${encodeURIComponent(text)}`);
  const rows = (await found.json()).data as { id:string; content:string }[];
  expect(rows.some(row => row.content === text)).toBe(true);
  for (const row of rows.filter(item => item.content === text)) await request.delete(`/api/memories/${row.id}`);
});

test('encrypted offline queue stores ciphertext and syncs sensitive drafts', async ({ page, request }) => {
  const note = `Encrypted offline note ${randomUUID()}`;
  await page.goto('/capture');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.getByLabel('Local queue passphrase').fill('correct local queue passphrase');
  await page.context().setOffline(true);
  await page.getByLabel('Thought, quote, or note').fill(note);
  await page.getByLabel('Keep out of review suggestions').check();
  await page.getByRole('button', { name: 'Save memory' }).click();
  await expect(page.getByRole('status')).toContainText('Saved on this device; waiting to sync');
  const stored = await page.evaluate(async () => new Promise<unknown>((resolve, reject) => {
    const open = indexedDB.open('memoryscape-offline-capture');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => { const db = open.result; const get = db.transaction('outbox').objectStore('outbox').getAll(); get.onsuccess = () => { db.close(); resolve(get.result); }; get.onerror = () => reject(get.error); };
  }));
  expect(JSON.stringify(stored)).not.toContain(note);
  expect(JSON.stringify(stored)).not.toContain('content');
  await page.getByLabel('Local queue passphrase').fill('incorrect local queue passphrase');
  await page.context().setOffline(false);
  await page.getByRole('button', { name: 'Sync encrypted drafts' }).click();
  await expect(page.locator('.error[role=alert]')).toContainText('Check the passphrase');
  await expect(page.getByText(/1 offline capture waiting on this device/)).toBeVisible();
  await page.getByLabel('Local queue passphrase').fill('correct local queue passphrase');
  await page.getByRole('button', { name: 'Sync encrypted drafts' }).click();
  await expect(page.getByRole('status')).toContainText('Synced 1 offline capture');
  const found = await request.get(`/api/memories?q=${encodeURIComponent(note)}`);
  const rows = (await found.json()).data as {id:string;content:string;is_sensitive:boolean}[];
  const created = rows.find(row=>row.content===note);
  expect(created?.is_sensitive).toBe(true);
  if (created) await request.delete(`/api/memories/${created.id}`);
});

test('discarding locked offline drafts requires explicit confirmation',async({page})=>{
  await page.goto('/capture');
  await page.getByLabel('Local queue passphrase').fill('correct local queue passphrase');
  await page.context().setOffline(true);
  await page.getByLabel('Thought, quote, or note').fill(`Discard fixture ${randomUUID()}`);
  await page.getByRole('button',{name:'Save memory'}).click();
  await expect(page.getByRole('status')).toContainText('Saved on this device');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Discard encrypted drafts'}).click();
  await expect(page.getByText(/1 offline capture waiting on this device/)).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Discard encrypted drafts'}).click();
  await expect(page.getByRole('status')).toContainText('Discarded 1 offline capture');
  const remaining=await page.evaluate(async()=>new Promise<number>((resolve,reject)=>{const open=indexedDB.open('memoryscape-offline-capture');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result;const count=db.transaction('outbox').objectStore('outbox').count();count.onsuccess=()=>{db.close();resolve(count.result)};count.onerror=()=>reject(count.error)}}));
  expect(remaining).toBe(0);
});
