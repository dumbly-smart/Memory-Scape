import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  ['dashboard', '/'],
  ['memory library', '/memories'],
  ['spatial memory walk', '/spatial'],
  ['spatiotemporal recall', '/research/spatiotemporal'],
  ['timeline', '/timeline'],
  ['associative graph', '/graph'],
  ['fading review', '/review'],
  ['settings', '/settings'],
] as const;

test('primary application pages have no WCAG 2.1 A/AA axe violations', async ({ page }) => {
  for (const [name, path] of pages) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const violations = results.violations.map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      elements: nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    }));
    expect(violations, `${name} accessibility violations`).toEqual([]);
  }
});

test('primary application pages have no WCAG 2.1 A/AA axe violations at mobile width', async ({ page }) => {
  // Eight sequential axe scans need headroom when the full browser suite shares one worker.
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, path] of pages) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const violations = results.violations.map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      elements: nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    }));
    expect(violations, `${name} accessibility violations at mobile width`).toEqual([]);
  }
});
