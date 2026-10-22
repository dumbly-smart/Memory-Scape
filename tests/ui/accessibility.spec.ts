import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  ['dashboard', '/'],
  ['memory library', '/memories'],
  ['spatial memory walk', '/spatial'],
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
