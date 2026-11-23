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
  /**
   * Every page load restores the session with `POST /auth/refresh`, which the API limits to 30 a minute
   * per address. Specs that are not about signing in get "not signed in" without calling the API; a spec
   * that signs in for real sets this true.
   */
  realSession: boolean;
  cspViolations: () => Promise<string[]>;
}

/**
 * Every e2e spec uses this `test`: the production build is served with the production
 * Content-Security-Policy in report-only mode, and any violation fails the test
 * (plan.md §11, plans/01-foundation.md §2.12).
 */
/** Starts recording Content-Security-Policy violations on a page (for a spec that makes its own pages). */
export async function watchCsp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations?.push(`${event.violatedDirective} blocked ${event.blockedURI}`);
    });
  });
}

export async function expectNoCspViolations(page: Page): Promise<void> {
  const violations = await page.evaluate(() => window.__cspViolations ?? []);
  expect(violations, 'Content-Security-Policy violations').toEqual([]);
}

export const test = base.extend<Fixtures>({
  allowCspViolations: [false, { option: true }],
  realSession: [false, { option: true }],
  cspViolations: async ({ page }, provide) => {
    await provide(() => page.evaluate(() => window.__cspViolations ?? []));
  },
  page: async ({ page, allowCspViolations, realSession }, provide) => {
    await watchCsp(page);
    if (!realSession) {
      await page.route('**/api/v1/auth/refresh', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          headers: {
            'access-control-allow-origin': 'http://localhost:4173',
            'access-control-allow-credentials': 'true',
          },
          body: JSON.stringify({
            error: {
              status: 401,
              code: 'UNAUTHENTICATED',
              message: 'No session.',
              requestId: 'e2e-stub',
            },
          }),
        }),
      );
    }
    await provide(page);
    if (!allowCspViolations) await expectNoCspViolations(page);
  },
});

export { expect };

/** Fails on any WCAG 2.2 AA violation on the current page. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  // A colour that is still fading (a button that just changed state) is read by axe half-way. Endless
  // animations (a spinner) never finish, so only the finite ones are waited for.
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
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
