import { expect,test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('saved-search API validates filters and supports create, update, list, and delete',async({request})=>{
  const name=`Saved ${randomUUID()}`;
  const created=await request.post('/api/saved-searches',{data:{name,filters:{q:'campus',sort:'occurred_desc'}}});
  expect(created.status()).toBe(201);
  const id=(await created.json()).data.id as string;
  try {
    expect((await request.post('/api/saved-searches',{data:{name:`Bad ${randomUUID()}`,filters:{query:'unsafe'}}})).status()).toBe(400);
    expect((await request.post('/api/saved-searches',{data:{name:'x'.repeat(81),filters:{}}})).status()).toBe(400);
    expect((await request.post('/api/saved-searches',{data:{name:`Bad date ${randomUUID()}`,filters:{from:'2026-02-30'}}})).status()).toBe(400);
    expect((await request.post('/api/saved-searches',{data:{name,filters:{q:'other'}}})).status()).toBe(409);
    expect((await request.get('/api/saved-searches')).json()).resolves.toMatchObject({data:[expect.objectContaining({id,name,filters:{q:'campus',sort:'occurred_desc'}})]});
    const updated=await request.patch(`/api/saved-searches/${id}`,{data:{name:`Renamed ${name}`,filters:{minStrength:'0.5',hasLocation:'true'}}});
    expect(updated.status()).toBe(200);
    expect((await updated.json()).data).toMatchObject({name:`Renamed ${name}`,filters:{minStrength:'0.5',hasLocation:'true'}});
  } finally { await request.delete(`/api/saved-searches/${id}`); }
});

test('memory library saves, applies, and deletes saved searches',async({page,request})=>{
  const suffix=randomUUID();
  const initial=`Library filter ${suffix}`;
  const name=`UI saved ${suffix}`;
  const created=await request.post('/api/saved-searches',{data:{name:initial,filters:{q:'seed query',sort:'strength_desc'}}});
  expect(created.status()).toBe(201);
  const id=(await created.json()).data.id as string;
  try {
    await page.goto('/memories');
    await page.locator('select[aria-label="Saved searches"]').selectOption(id);
    await page.getByRole('button',{name:'Apply saved search'}).click();
    await expect(page.getByLabel('Search memories')).toHaveValue('seed query');
    await expect(page.getByLabel('Sort memories')).toHaveValue('strength_desc');
    await page.getByLabel('Search memories').fill('campus walk');
    await page.getByLabel('New saved search name').fill(name);
    await page.getByRole('button',{name:'Save current search'}).click();
    await expect(page.getByRole('status')).toContainText('Saved search');
    const list=(await (await request.get('/api/saved-searches')).json()).data as {id:string;name:string}[];
    const saved=list.find(item=>item.name===name);
    expect(saved).toBeTruthy();
    await page.locator('select[aria-label="Saved searches"]').selectOption(saved!.id);
    await page.getByRole('button',{name:'Delete saved search'}).click();
    await expect(page.getByRole('status')).toContainText('Deleted');
    expect((await request.get(`/api/saved-searches/${saved!.id}`)).status()).toBe(404);
  } finally { await request.delete(`/api/saved-searches/${id}`); }
});
