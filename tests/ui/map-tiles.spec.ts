import { expect, test } from '@playwright/test';

test('settings can configure and reset a local XYZ tile server', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Map tile source' })).toBeVisible();
  await page.getByLabel('XYZ tile URL template').fill('http://localhost:8080/tiles/{z}/{x}/{y}.png');
  await page.getByLabel('Attribution').fill('My local tile server');
  await page.getByRole('button', { name: 'Save tile source' }).click();
  await expect(page.getByRole('status')).toContainText('Saved for this browser');
  expect(await page.evaluate(() => localStorage.getItem('memoryscape.mapTiles.v1'))).toContain('localhost:8080');
  await page.getByRole('button', { name: 'Use default' }).click();
  expect(await page.evaluate(() => localStorage.getItem('memoryscape.mapTiles.v1'))).toBeNull();
});
