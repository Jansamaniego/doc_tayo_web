import { expect, expectNoAxeViolations, test } from './fixtures/test.ts';

test.describe('smoke', () => {
  test('the home page loads and the real API is reachable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'DocTayo' })).toBeVisible();
    await expect(page.getByText('API reachable')).toBeVisible();
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('API reachable')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('the skip link is the first tab stop and moves focus to the main content', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'Safari does not Tab to links by default.');
    await page.goto('/');
    // The app renders after the page's load event: wait for it before using the keyboard.
    await expect(page.getByRole('heading', { level: 1, name: 'DocTayo' })).toBeVisible();
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('the home page reads well in a very narrow, zoomed window (320 CSS px)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    await expect(page.getByText('API reachable')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
