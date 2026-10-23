import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('daily brief surfaces overdue follow-ups linked to a memory', async ({ request, page }) => {
  const capture = await request.post('/api/capture', { data: { content: `Daily brief fixture ${randomUUID()}` } });
  expect(capture.status()).toBe(201);
  const memoryId = (await capture.json()).data.id as string;
  let decisionId='';
  try {
    const followUp = await request.post('/api/follow-ups', { data: { title: 'Review the field notes', description: 'A due item for the daily brief', dueAt: '2020-01-01T00:00:00.000Z', memoryId } });
    expect(followUp.status()).toBe(201);
    const decision=await request.post('/api/decisions',{data:{choice:'Revisit this study plan',rationale:'Confirm the next step',decidedAt:'2019-12-31T00:00:00.000Z',revisitAt:'2020-01-01T00:00:00.000Z',memoryId}});
    expect(decision.status()).toBe(201);
    decisionId=(await decision.json()).data.id as string;
    const response = await request.get('/api/daily');
    expect(response.status()).toBe(200);
    const brief=(await response.json()).data;
    expect(brief.dueFollowUps.some((row: { title: string }) => row.title === 'Review the field notes')).toBe(true);
    expect(brief.decisionsToRevisit.some((row: { choice: string }) => row.choice === 'Revisit this study plan')).toBe(true);
    await page.goto('/daily');
    await expect(page.getByRole('heading', { name: 'Today, in context' })).toBeVisible();
    await expect(page.getByText('Review the field notes')).toBeVisible();
    await expect(page.getByRole('button', { name: /Enable daily notifications/ })).toBeVisible();
    await request.patch('/api/memories/'+memoryId,{data:{isSensitive:true}});
    const privateBrief=(await (await request.get('/api/daily')).json()).data;
    expect(privateBrief.dueFollowUps.some((row: {title:string})=>row.title==='Review the field notes')).toBe(false);
    expect(privateBrief.decisionsToRevisit.some((row: {choice:string})=>row.choice==='Revisit this study plan')).toBe(false);
  } finally {
    await request.delete(`/api/memories/${memoryId}`);
  }
});


test('daily notifications explain unsupported browsers and denied permission',async({page})=>{
  await page.goto('/daily');
  await page.evaluate(()=>Object.defineProperty(window,'Notification',{configurable:true,value:undefined}));
  await page.getByRole('button',{name:/Enable daily notifications/}).click();
  await expect(page.getByRole('status')).toContainText('does not support notifications');
});

test('daily notifications remain optional when browser permission is denied',async({page})=>{
  await page.goto('/daily');
  await page.evaluate(()=>Object.defineProperty(window,'Notification',{configurable:true,value:{permission:'denied',requestPermission:async()=> 'denied'}}));
  await page.getByRole('button',{name:/Enable daily notifications/}).click();
  await expect(page.getByRole('status')).toContainText('Notifications were not enabled');
});
