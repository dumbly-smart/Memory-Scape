import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

const database = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://memoryscape:memoryscape_local@127.0.0.1:5432/memoryscape',
});

test('configured password protects pages and API routes, limits failures, and can be signed out', async ({ page, request }) => {
  const password = process.env.E2E_AUTH_PASSWORD;
  expect(password, 'E2E_AUTH_PASSWORD must be provided for the configured-auth run').toBeTruthy();
  await page.goto('/memories');
  await expect(page).toHaveURL(/\/login\?/);
  const blocked = await page.evaluate(async () => (await fetch('/api/memories')).status);
  expect(blocked).toBe(401);
  await page.getByLabel('Workspace password').fill('incorrect-test-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.error')).toContainText('Incorrect password');
  await page.getByLabel('Workspace password').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/memories$/);
  const allowed = await page.evaluate(async () => (await fetch('/api/memories')).status);
  expect(allowed).toBe(200);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const failed = await request.post('/api/auth/login', { data: { password: 'incorrect-test-password' } });
      expect(failed.status()).toBe(401);
    }
    const blockedLogin = await request.post('/api/auth/login', { data: { password } });
    expect(blockedLogin.status()).toBe(429);
    expect(Number(blockedLogin.headers()['retry-after'])).toBeGreaterThan(0);
  } finally {
    await database.query('SELECT clear_workspace_login_limit()');
    await database.end();
  }
});
