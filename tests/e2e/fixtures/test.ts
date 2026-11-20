import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Page } from '@playwright/test';

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

interface Fixtures {
  /** Set true only in the spec that proves the violation detector works. */
  allowCspViolations: boolean;
  cspViolations: () => Promise<string[]>;
}

/**
 * Every e2e spec uses this `test`: the production build is served with the production
 * Content-Security-Policy in report-only mode, and any violation fails the test
 * (plan.md §11, plans/01-foundation.md §2.12).
 */
export const test = base.extend<Fixtures>({
  allowCspViolations: [false, { option: true }],
  cspViolations: async ({ page }, provide) => {
    await provide(() => page.evaluate(() => window.__cspViolations ?? []));
  },
  page: async ({ page, allowCspViolations }, provide) => {
    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        window.__cspViolations?.push(`${event.violatedDirective} blocked ${event.blockedURI}`);
      });
    });
    await provide(page);
    if (!allowCspViolations) {
      const violations = await page.evaluate(() => window.__cspViolations ?? []);
      expect(violations, 'Content-Security-Policy violations').toEqual([]);
    }
  },
});

export { expect };

/** Fails on any WCAG 2.2 AA violation on the current page. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  // A short, readable list (rule, how serious, where, why) instead of axe's full report.
  const summary = results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id} (${violation.impact ?? 'n/a'}): ${node.target.join(' ')} - ${(node.any[0]?.message ?? node.failureSummary ?? '').slice(0, 160)}`,
    ),
  );
  expect(summary, 'accessibility violations').toEqual([]);
}
