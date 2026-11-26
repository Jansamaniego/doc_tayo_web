import type { Browser, BrowserContext, Page } from '@playwright/test';

import { accounts } from './fixtures/accounts.ts';
import {
  expect,
  expectNoAxeViolations,
  expectNoCspViolations,
  test,
  watchCsp,
} from './fixtures/test.ts';

// The Practitioners list, a practitioner's page and "My schedule" against the real API
// (plans/07-appointments-and-scheduling.md, sub-phases 7.1 and 7.2, and the refusals of 7.3 and 7.4). Read-only. It needs the practitioners the backend's `npm run db:seed:dev` creates since backend 5.2:
// "Dr. Dan Doctor, MD" in Sunrise (hours at Main and at the Quezon City Annex) and "Dr. Maya Multi, MD"
// in Lakeside. Each account signs in once per run. Changes are tested in practitioner-management.spec.ts.
test.describe.configure({ mode: 'serial' });

const SUNRISE_DOCTOR = 'Dr. Dan Doctor, MD';
const LAKESIDE_DOCTOR = 'Dr. Maya Multi, MD';
/** The address of the Sunrise doctor, remembered so the other clinic can try to open it. */
let sunriseDoctorPath = '';

/** The next date with this ISO weekday (1 = Monday), at least a week ahead, as calendar parts. */
function nextWeekday(weekday: number): { month: string; day: string; year: string } {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  while ((date.getUTCDay() || 7) !== weekday) date.setUTCDate(date.getUTCDate() + 1);
  return {
    month: String(date.getUTCMonth() + 1),
    day: String(date.getUTCDate()),
    year: String(date.getUTCFullYear()),
  };
}

async function chooseDay(page: Page, weekday: number): Promise<void> {
  const { month, day, year } = nextWeekday(weekday);
  await page.getByLabel('Month').selectOption(month);
  await page.getByLabel('Day', { exact: true }).fill(day);
  await page.getByLabel('Year').fill(year);
}

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

  test('opens Practitioners from the navigation and sees the clinic’s doctor, with no Status column', async () => {
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Practitioners' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Practitioners' })).toBeVisible();
    const row = page.getByRole('row', { name: new RegExp(SUNRISE_DOCTOR.replace('.', '\\.')) });
    await expect(row).toContainText('Dr. Dan Doctor');
    await expect(page.getByRole('columnheader', { name: 'Status' })).toHaveCount(0);
    await expect(page.getByText(LAKESIDE_DOCTOR)).toHaveCount(0);
    // The directory carries no e-mail address.
    await expect(page.getByRole('main')).not.toContainText('@');
    await expectNoAxeViolations(page);
  });

  test('filters by branch, keeping the branch in the address', async () => {
    await page.goto('/practitioners');
    for (const branch of ['Quezon City Annex', /^Main/] as const) {
      const options = page.getByLabel('Branch').locator('option');
      await expect(options.first()).toHaveText('All branches');
      const label =
        typeof branch === 'string' ? branch : await options.filter({ hasText: branch }).innerText();
      await page.getByLabel('Branch').selectOption({ label });
      await expect(page).toHaveURL(/branch=[0-9a-f-]{36}/);
      await expect(page.getByText(SUNRISE_DOCTOR)).toBeVisible();
    }
    await page.reload();
    await expect(page.getByText(SUNRISE_DOCTOR)).toBeVisible();
    await page.getByLabel('Branch').selectOption({ label: 'All branches' });
    await expect(page).not.toHaveURL(/branch=/);
  });

  test('ignores a branch in the address that is not an id', async () => {
    await page.goto('/practitioners?branch=nonsense&page=abc');
    await expect(page.getByText(SUNRISE_DOCTOR)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('opens the doctor from the list: profile and weekly schedule, no manager controls', async () => {
    await page.goto('/practitioners');
    await page.getByRole('link', { name: SUNRISE_DOCTOR }).click();
    await expect(page.getByRole('heading', { level: 1, name: SUNRISE_DOCTOR })).toBeVisible();
    await expect(page).toHaveURL(/\/practitioners\/[0-9a-f-]{36}$/);
    sunriseDoctorPath = new URL(page.url()).pathname;
    await expect(page.getByRole('main')).toContainText('Family Medicine');
    await expect(page.getByRole('main')).toContainText('Dr. Dan Doctor');
    const week = page.getByRole('region', { name: 'Weekly schedule' });
    await expect(week).toContainText('9:00 AM – 12:00 PM, Main');
    await expect(week).toContainText('1:00 PM – 5:00 PM, Main');
    await expect(week).toContainText('9:00 AM – 12:00 PM, Quezon City Annex');
    await expect(week).toContainText('No hours');
    await expect(page.getByRole('link', { name: /Edit|Deactivate/ })).toHaveCount(0);
    await expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'My schedule' }),
    ).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test('cannot add or edit one: no page, no button, and the API refuses', async () => {
    const managerPages = ['edit', 'schedule'].map((page) => `${sunriseDoctorPath}/${page}`);
    for (const path of ['/practitioners/new', ...managerPages]) {
      await page.goto(path);
      await expect(
        page.getByRole('heading', { level: 1, name: "You don't have access to this page" }),
      ).toBeVisible();
    }
    // The page reads the doctor with the access token: the same token is then used to try a change.
    const [read] = await Promise.all([
      page.waitForRequest((request) => request.url().includes('/api/v1/practitioners/')),
      page.goto(sunriseDoctorPath),
    ]);
    const authorization = (await read.allHeaders()).authorization ?? '';
    expect(authorization).toMatch(/^Bearer /);
    const answer = await page.request.post(new URL('/api/v1/practitioners', read.url()).href, {
      headers: { authorization },
      data: { membershipId: '00000000-0000-4000-8000-000000000000', displayName: 'Not allowed' },
    });
    expect(answer.status()).toBe(403);
    // The schedule too: refused before anything is replaced.
    const id = sunriseDoctorPath.split('/').pop() ?? '';
    const week = await page.request.put(
      new URL(`/api/v1/practitioners/${id}/schedule`, read.url()).href,
      { headers: { authorization }, data: { blocks: [] } },
    );
    expect(week.status()).toBe(403);
    await page.goto('/practitioners');
    await expect(page.getByText(SUNRISE_DOCTOR)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add a practitioner' })).toHaveCount(0);
  });

  test('shows the working hours of a chosen day, in the branch’s zone', async () => {
    await page.goto(sunriseDoctorPath);
    const hours = page.getByRole('region', { name: 'Working hours on a day' });
    await expect(hours).toContainText('Booked appointments are not counted yet.');
    await page.getByLabel('Branch').selectOption({ index: 0 });
    await chooseDay(page, 1); // a Monday
    await expect(hours).toContainText('9:00 AM – 12:00 PM');
    await expect(hours).toContainText('1:00 PM – 5:00 PM');
    await expect(hours).toContainText('Times are in Asia/Manila.');
    await chooseDay(page, 7); // a Sunday
    await expect(hours).toContainText('No working hours on this day');
    // The calendar opens (and breaks no content security policy).
    await page.getByRole('button', { name: 'Choose on calendar' }).click();
    await expect(page.getByRole('grid')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.keyboard.press('Escape');
  });

  test('the doctor’s page fits a phone screen', async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(sunriseDoctorPath);
    await expect(page.getByRole('heading', { level: 1, name: SUNRISE_DOCTOR })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Weekly schedule' })).toContainText('Main');
    await expect.poll(() => overflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('says it could not find an unknown or broken address', async () => {
    for (const path of [
      '/practitioners/00000000-0000-4000-8000-000000000000',
      '/practitioners/x',
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole('heading', { level: 1, name: 'We could not find this practitioner' }),
      ).toBeVisible();
    }
  });

  test('fits a phone screen with no sideways scrolling', async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/practitioners');
    await expect(page.getByText(SUNRISE_DOCTOR)).toBeVisible();
    await expect.poll(() => overflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});

test.describe('another clinic', () => {
  test('shows its own practitioner, with a Status column for its manager, and never Sunrise’s', async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'one browser is enough for this read-only pass',
    );
    const { context, page } = await signedInPage(browser, baseURL, accounts.lakesideOwner);
    await page.goto('/practitioners');
    await expect(page.getByRole('row', { name: /Dr\. Maya Multi/ })).toContainText('Active');
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByText(SUNRISE_DOCTOR)).toHaveCount(0);
    await expectNoAxeViolations(page);
    // Sunrise's doctor, opened from Lakeside: not found, never whose it is.
    expect(sunriseDoctorPath).not.toBe('');
    await page.goto(sunriseDoctorPath);
    await expect(
      page.getByRole('heading', { level: 1, name: 'We could not find this practitioner' }),
    ).toBeVisible();
    await expect(page.getByText(SUNRISE_DOCTOR)).toHaveCount(0);
    await expectNoCspViolations(page);
    await context.close();
  });
});

test.describe('"My schedule"', () => {
  test('a doctor opens their own page from it', async ({ browser, baseURL }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'one browser is enough for this read-only pass',
    );
    const { context, page } = await signedInPage(browser, baseURL, accounts.doctor);
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'My schedule' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: SUNRISE_DOCTOR })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'My schedule' }),
    ).toHaveAttribute('aria-current', 'page');
    await expectNoAxeViolations(page);
    await expectNoCspViolations(page);
    await context.close();
  });

  test('follows the clinic: there in Lakeside, gone after switching to Sunrise', async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'one browser is enough for this read-only pass',
    );
    const context = await browser.newContext(baseURL ? { baseURL } : {});
    const page = await context.newPage();
    await watchCsp(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login');
    await page.getByLabel('Email').fill(accounts.multiClinic.email);
    await page.getByLabel('Password').fill(accounts.multiClinic.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: /Lakeside Family Clinic/ }).click();
    const mine = page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'My schedule' });
    await mine.click();
    await expect(page.getByRole('heading', { level: 1, name: LAKESIDE_DOCTOR })).toBeVisible();
    await page.getByRole('button', { name: /Switch clinic/ }).click();
    await page.getByRole('menuitemradio', { name: 'Sunrise Clinic' }).click();
    await expect(page.getByRole('button', { name: /Sunrise Clinic/ })).toBeVisible();
    await expect(mine).toHaveCount(0);
    await expectNoCspViolations(page);
    await context.close();
  });
});
