import type { Browser, BrowserContext, Page } from '@playwright/test';

import { accounts } from './fixtures/accounts.ts';
import {
  expect,
  expectNoAxeViolations,
  expectNoCspViolations,
  test,
  watchCsp,
} from './fixtures/test.ts';

// The services list and a service's page against the real API (plans/08-services-catalog.md,
// sub-phase 8.1, and the refusals of 8.2). Read-only; changes are tested in
// service-management.spec.ts. It needs the services the backend's `npm run db:seed:dev` creates since
// the services catalog: General consultation, Follow-up, ... and an inactive Medical certificate in
// Sunrise; General consultation and Vaccination in Lakeside. Each account signs in once per run.
test.describe.configure({ mode: 'serial' });

/** The address of a Sunrise service, remembered so the other clinic can try to open it. */
let sunriseServicePath = '';

async function signedInPage(
  browser: Browser,
  baseURL: string | undefined,
  account: { email: string; password: string },
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(baseURL ? { baseURL } : {});
  const page = await context.newPage();
  await watchCsp(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
  return { context, page };
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const row = (page: Page, name: string) =>
  page.getByRole('row').filter({ has: page.getByRole('link', { name, exact: true }) });

async function openServices(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Clinic' })
    .click();
  await page
    .getByRole('navigation', { name: 'Clinic sections' })
    .getByRole('link', { name: 'Services' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Services and prices' })).toBeVisible();
}

test.describe('the front desk', () => {
  let context: BrowserContext | undefined;
  let page: Page;

  test.beforeAll(async ({ browser, baseURL }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'one browser is enough for this read-only pass',
    );
    ({ context, page } = await signedInPage(browser, baseURL, accounts.receptionist));
  });
  test.beforeEach(async () => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });
  test.afterEach(async () => {
    await expectNoCspViolations(page);
  });
  test.afterAll(async () => {
    await context?.close();
  });

  test('opens Services from the Clinic tabs and sees the active services and prices', async () => {
    await openServices(page);
    await expect(row(page, 'General consultation')).toContainText('Price at the desk');
    await expect(row(page, 'General consultation')).toContainText('30 minutes');
    await expect(row(page, 'Follow-up')).toContainText('₱300.00');
    await expect(row(page, 'Follow-up')).toContainText('15 minutes');
    // Inactive services and statuses are for the people who manage services.
    await expect(page.getByText('Medical certificate')).toHaveCount(0);
    await expect(page.getByText('Vaccination')).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Status' })).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test('opens a service: price and usual length, no controls', async () => {
    await page.goto('/clinic/services');
    await page.getByRole('link', { name: 'Follow-up', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Follow-up' })).toBeVisible();
    await expect(page).toHaveURL(/\/clinic\/services\/[0-9a-f-]{36}$/);
    sunriseServicePath = new URL(page.url()).pathname;
    await expect(page.getByRole('main')).toContainText('15 minutes');
    await expect(page.getByRole('main')).toContainText('₱300.00');
    await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
    await expectNoAxeViolations(page);
    await page.getByRole('link', { name: 'All services' }).click();
    await expect(row(page, 'Follow-up')).toBeVisible();
  });

  test('ignores unusable address values, and leaves a page past the end', async () => {
    await page.goto('/clinic/services?inactive=1&page=abc&pageSize=7');
    await expect(row(page, 'Follow-up')).toBeVisible();
    await expect(page.getByText('Medical certificate')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.goto('/clinic/services?page=9');
    await expect(row(page, 'Follow-up')).toBeVisible();
    await expect(page).toHaveURL(/\/clinic\/services$/);
  });

  test('cannot add or change one: no page, no button, and the API refuses', async () => {
    await page.goto('/clinic/services');
    await expect(row(page, 'Follow-up')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add a service' })).toHaveCount(0);
    await page.goto('/clinic/services/new');
    await expect(
      page.getByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeVisible();
    // The page reads the services with the access token: the same token is then used to try a change.
    const [read] = await Promise.all([
      page.waitForRequest((request) => request.url().includes('/api/v1/services')),
      page.goto('/clinic/services'),
    ]);
    const authorization = (await read.allHeaders()).authorization ?? '';
    expect(authorization).toMatch(/^Bearer /);
    const answer = await page.request.post(new URL('/api/v1/services', read.url()).href, {
      headers: { authorization },
      data: { name: 'Not allowed', defaultDurationMinutes: 30 },
    });
    expect(answer.status()).toBe(403);
    const id = sunriseServicePath.split('/').pop() ?? '';
    const change = await page.request.patch(new URL(`/api/v1/services/${id}`, read.url()).href, {
      headers: { authorization },
      data: { price: '1.00' },
    });
    expect(change.status()).toBe(403);
  });

  test('says it could not find an unknown or broken address', async () => {
    for (const path of [
      '/clinic/services/00000000-0000-4000-8000-000000000000',
      '/clinic/services/x',
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole('heading', { level: 1, name: 'We could not find this service' }),
      ).toBeVisible();
    }
  });

  test('fits a phone screen with no sideways scrolling', async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const [path, text] of [
      ['/clinic/services', 'General consultation'],
      [sunriseServicePath, 'Follow-up'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('main')).toContainText(text);
      await expect.poll(() => overflow(page)).toBeLessThanOrEqual(0);
      await expectNoAxeViolations(page);
    }
  });
});

test.describe('the owner', () => {
  test('can show inactive services, marked, and keeps that in the address', async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'one browser is enough for this read-only pass',
    );
    const { context, page } = await signedInPage(browser, baseURL, accounts.owner);
    await openServices(page);
    await expect(row(page, 'Follow-up')).toContainText('Active');
    await expect(page.getByText('Medical certificate')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Show inactive services' }).click();
    await expect(page).toHaveURL(/inactive=1/);
    await expect(row(page, 'Medical certificate')).toContainText('Inactive');
    await page.reload();
    await expect(row(page, 'Medical certificate')).toContainText('Inactive');
    await expectNoAxeViolations(page);
    await page.getByRole('link', { name: 'Medical certificate' }).click();
    await expect(
      page.getByText('This service is inactive. It is not offered when booking.'),
    ).toBeVisible();
    await expectNoAxeViolations(page);
    await expectNoCspViolations(page);
    await context.close();
  });
});

test.describe('another clinic', () => {
  test('sees only its own services, and cannot open Sunrise’s', async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'one browser is enough for this read-only pass',
    );
    const { context, page } = await signedInPage(browser, baseURL, accounts.lakesideOwner);
    await openServices(page);
    await expect(row(page, 'Vaccination')).toContainText('₱350.00');
    await expect(page.getByText('Follow-up')).toHaveCount(0);
    await page.goto(sunriseServicePath);
    await expect(
      page.getByRole('heading', { level: 1, name: 'We could not find this service' }),
    ).toBeVisible();
    await expect(page.getByRole('main')).not.toContainText('Follow-up');
    await expectNoCspViolations(page);
    await context.close();
  });
});
