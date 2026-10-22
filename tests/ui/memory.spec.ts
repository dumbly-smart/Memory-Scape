import { expect, test } from '@playwright/test';

test('captures, edits, and deletes a memory through the library', async ({ page }) => {
  const title = `Browser fixture ${Date.now()}`;
  await page.goto('/memories');
  await page.getByRole('button', { name: 'New memory' }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('What happened?').fill('Created from the browser integration test.');
  await page.getByRole('button', { name: 'Save memory' }).click();
  await expect(page.getByRole('button', { name: title })).toBeVisible();
  await page.getByRole('button', { name: title }).click();
  await page.getByRole('button', { name: 'Edit memory' }).click();
  await page.getByLabel('Title').fill(`${title} revised`);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: `${title} revised` })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete memory' }).click();
  await expect(page.getByRole('button', { name: `${title} revised` })).toHaveCount(0);
});
