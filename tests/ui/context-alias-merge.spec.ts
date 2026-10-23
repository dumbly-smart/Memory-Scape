import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('context aliases resolve on capture and merge moves references without losing records', async ({ request }) => {
  const suffix=randomUUID();
  const sourceLabel=`Source topic ${suffix}`;
  const targetLabel=`Target topic ${suffix}`;
  const alias=`Legacy wording ${suffix}`;
  const context=(await request.post('/api/contexts',{data:{type:'Topic',label:sourceLabel}})).json();
  const targetResponse=await request.post('/api/contexts',{data:{type:'Topic',label:targetLabel}});
  const sourceId=(await context).data.id as string;
  const targetId=(await targetResponse.json()).data.id as string;
  const memoryResponse=await request.post('/api/capture',{data:{content:`Alias merge fixture ${suffix}`}});
  const memoryId=(await memoryResponse.json()).data.id as string;
  let followUpId='';let decisionId='';
  try {
    expect((await request.post('/api/contexts',{data:{type:'Topic',label:sourceLabel,memoryId}})).status()).toBe(201);
    const aliasResponse=await request.post(`/api/contexts/${sourceId}/aliases`,{data:{alias}});
    expect(aliasResponse.status()).toBe(201);
    const beforeAlias=await request.get(`/api/memories/${memoryId}`);
    const linkByAlias=await request.post('/api/contexts',{data:{type:'Topic',label:alias,memoryId}});
    expect((await linkByAlias.json()).data.inserted).toBe(false);
    const afterAlias=await request.get(`/api/memories/${memoryId}`);
    expect((await afterAlias.json()).data.reinforcements).toHaveLength((await beforeAlias.json()).data.reinforcements.length);
    const followUp=await request.post('/api/follow-ups',{data:{title:`Alias follow-up ${suffix}`,memoryId,contextId:sourceId}});
    followUpId=(await followUp.json()).data.id;
    const decision=await request.post('/api/decisions',{data:{choice:`Alias decision ${suffix}`,rationale:'Keep context continuity',contextId:sourceId}});
    decisionId=(await decision.json()).data.id;
    const merge=await request.post('/api/contexts/merge',{data:{sourceId,targetId}});
    expect(merge.status()).toBe(200);
    expect((await merge.json()).data).toMatchObject({memoryLinksMoved:1,followUpsMoved:1,decisionsMoved:1});
    const detail=await request.get(`/api/contexts/${targetId}/aliases`);
    expect((await detail.json()).data.map((row:{alias:string})=>row.alias)).toContain(sourceLabel);
    expect((await request.get(`/api/contexts/${sourceId}`)).status()).toBe(404);
    const memory=(await request.get(`/api/memories/${memoryId}`)).json();
    expect((await memory).data.contexts.map((row:{id:string})=>row.id)).toEqual([targetId]);
    expect((await (await request.get(`/api/follow-ups?contextId=${targetId}`)).json()).data.some((row:{id:string})=>row.id===followUpId)).toBe(true);
    expect((await (await request.get(`/api/decisions?contextId=${targetId}`)).json()).data.some((row:{id:string})=>row.id===decisionId)).toBe(true);
  } finally {
    if(followUpId) await request.delete(`/api/follow-ups/${followUpId}`);
    if(decisionId) await request.delete(`/api/decisions/${decisionId}`);
    await request.delete(`/api/memories/${memoryId}`);
    await request.delete(`/api/contexts/${targetId}`);
    await request.delete(`/api/contexts/${sourceId}`);
  }
});


test('context page adds an alias and confirms a same-type merge', async ({page,request})=>{
  const suffix=randomUUID();
  const source=(await (await request.post('/api/contexts',{data:{type:'Project',label:`UI source ${suffix}`}})).json()).data;
  const target=(await (await request.post('/api/contexts',{data:{type:'Project',label:`UI target ${suffix}`}})).json()).data;
  try {
    await page.goto(`/contexts/${source.id}`);
    await page.getByLabel('Add alias').fill(`Old project ${suffix}`);
    await page.getByRole('button',{name:'Add alias'}).click();
    await expect(page.getByRole('status')).toContainText('as an alias');
    await page.getByLabel('Merge into a same-type context').selectOption(target.id);
    page.once('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'Merge context'}).click();
    await expect(page).toHaveURL(new RegExp(`/contexts/${target.id}$`));
    await expect(page.getByRole('heading',{name:target.label})).toBeVisible();
  } finally { await request.delete(`/api/contexts/${target.id}`); await request.delete(`/api/contexts/${source.id}`); }
});

test('context merge rejects incompatible types without deleting either context',async({request})=>{
  const suffix=randomUUID();
  const source=(await (await request.post('/api/contexts',{data:{type:'Topic',label:`Type source ${suffix}`}})).json()).data;
  const target=(await (await request.post('/api/contexts',{data:{type:'Project',label:`Type target ${suffix}`}})).json()).data;
  try {
    const response=await request.post('/api/contexts/merge',{data:{sourceId:source.id,targetId:target.id}});
    expect(response.status()).toBe(400);
    expect((await request.get(`/api/contexts/${source.id}`)).status()).toBe(200);
    expect((await request.get(`/api/contexts/${target.id}`)).status()).toBe(200);
  } finally { await request.delete(`/api/contexts/${source.id}`); await request.delete(`/api/contexts/${target.id}`); }
});
