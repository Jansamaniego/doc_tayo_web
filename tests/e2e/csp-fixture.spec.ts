import { expect, test } from './fixtures/test.ts';

// Proves the violation detector works: without this, "zero violations" could mean "not listening".
test.describe('CSP violation detector', () => {
  test.use({ allowCspViolations: true });

  test('records an injected inline style as a violation', async ({ page, cspViolations }) => {
    await page.goto('/');
    await page.addStyleTag({ content: 'body { outline: 1px solid red; }' });
    expect((await cspViolations()).join('\n')).toContain('style-src');
  });
});
