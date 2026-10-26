import { expect, test } from '@playwright/test';

const routes = [
  '/',
  '/memories',
  '/spatial',
  '/research/spatiotemporal',
  '/timeline',
  '/graph',
  '/review',
  '/settings',
];

for (const viewport of [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test.describe(`${viewport.name} layout`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of routes) {
      test(`keeps ${route} within the viewport`, async ({ page }) => {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        if (new URL(page.url()).pathname === '/login') {
          const login = await page.request.post('/api/auth/login', {
            data: { password: process.env.E2E_AUTH_PASSWORD ?? 'local-test-password-long' },
          });
          expect(login.ok()).toBeTruthy();
          await page.goto(route, { waitUntil: 'domcontentloaded' });
        }
        await expect(page.locator('main')).toBeVisible();
        await expect.poll(async () => {
          try {
            return await page.evaluate(() => ({
              width: document.documentElement.clientWidth,
              scrollWidth: document.documentElement.scrollWidth,
            }));
          } catch {
            return null;
          }
        }).toEqual({ width: viewport.width, scrollWidth: viewport.width });
      });
    }
  });
}
