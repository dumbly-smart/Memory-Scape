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
    await expect(page.getByRole('button', { name: /Enable in-page notifications/ })).toBeVisible();
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
  await page.getByRole('button',{name:/Enable in-page notifications/}).click();
  await expect(page.getByRole('status')).toContainText('does not support notifications');
});

test('daily notifications remain optional when browser permission is denied',async({page})=>{
  await page.goto('/daily');
  await page.evaluate(()=>Object.defineProperty(window,'Notification',{configurable:true,value:{permission:'denied',requestPermission:async()=> 'denied'}}));
  await page.getByRole('button',{name:/Enable in-page notifications/}).click();
  await expect(page.getByRole('status')).toContainText('Notifications were not enabled');
});

test('background push registration is persisted and can be revoked',async({request})=>{
  const key=await request.get('/api/push/public-key');
  expect(key.status()).toBe(200);
  expect((await key.json()).data.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
  const endpoint=`https://fcm.googleapis.com/fcm/send/${randomUUID()}`;
  const subscription={endpoint,keys:{p256dh:'B'.repeat(43),auth:'a'.repeat(22)}};
  const invalid=await request.post('/api/push/subscriptions',{data:{...subscription,endpoint:'http://not-secure.test/push'}});
  expect(invalid.status()).toBe(400);
  const created=await request.post('/api/push/subscriptions',{data:subscription});
  expect(created.status()).toBe(201);
  const removed=await request.delete('/api/push/subscriptions',{data:{endpoint}});
  expect(removed.status()).toBe(200);
});

test('daily page offers opt-in browser push and removes the subscription when disabled',async({page})=>{
  await page.addInitScript(()=>{
    class FakeNotification { static permission='granted'; static requestPermission=async()=> 'granted'; constructor(_title:string,_options?:NotificationOptions){} }
    Object.defineProperty(window,'Notification',{configurable:true,value:FakeNotification});
    const serialized={endpoint:`https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`,keys:{p256dh:'B'.repeat(43),auth:'a'.repeat(22)}};
    let current:typeof subscription|null=null;
    const subscription={endpoint:serialized.endpoint,toJSON:()=>serialized,unsubscribe:async()=>{current=null;return true}};
    const registration={pushManager:{getSubscription:async()=>current,subscribe:async()=>{current=subscription;return subscription}}};
    Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{register:async()=>registration,ready:Promise.resolve(registration)}});
  });
  await page.goto('/daily');
  await page.getByRole('button',{name:'Enable background reminders'}).click();
  await expect(page.getByRole('status')).toContainText('Background reminders enabled');
  await expect(page.getByRole('button',{name:'Disable background reminders'})).toBeVisible();
  await page.getByRole('button',{name:'Disable background reminders'}).click();
  await expect(page.getByRole('status')).toContainText('Background reminders disabled');
});
