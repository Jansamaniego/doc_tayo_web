import { expect, test } from './fixtures/test.ts';

// Proves the violation detector works: without this, "zero violations" could mean "not listening".
test.describe('CSP violation detector', () => {
  test.use({ allowCspViolations: true });

  test('records an injected inline style as a violation', async ({ page, cspViolations }) => {
    await page.goto('/');
    // Created in the page: WebKit makes Playwright's own addStyleTag throw on a report-only violation.
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = 'body { outline: 1px solid red; }';
      document.head.appendChild(style);
    });
    expect((await cspViolations()).join('\n')).toContain('style-src');
  });
});
