import type { Browser, BrowserContext, Page } from '@playwright/test';

import { accounts } from './fixtures/accounts.ts';
import { findSetupLink } from './fixtures/mail.ts';
import {
  expect,
  expectNoAxeViolations,
  expectNoCspViolations,
  test,
  watchCsp,
} from './fixtures/test.ts';

// Adding, editing, deactivating and reactivating a practitioner, and editing their weekly schedule,
// against the real API (plans/07-appointments-and-scheduling.md, sub-phases 7.3 and 7.4).
//
// The changes are made in a clinic this spec creates (a platform admin creates it, its owner sets up
// the account from the emailed link), never in Sunrise, which is only used for the cross-clinic check:
// profiles cannot be deleted, so each run leaves one "E2E Practice ..." clinic with one practitioner.
// Each account signs in once per run. The API must run with MAIL_TRANSPORT=file and its
// CORS_ALLOWED_ORIGINS and APP_PUBLIC_URL set to the preview origin (http://localhost:4173).
test.describe.configure({ mode: 'serial' });

const STAMP = Date.now();
const CLINIC = `E2E Practice ${STAMP}`;
const OWNER_NAME = 'E2E Practice Owner';
const OWNER_EMAIL = `e2e-practice-${STAMP}@example.test`;
const OWNER_PASSWORD = 'an-e2e-owner-password-2026';
const DISPLAY_NAME = 'Dra. E2E Owner, MD';
const ANNEX = 'E2E Annex';

const contexts: BrowserContext[] = [];
let owner: Page;
let profilePath = '';

async function newPage(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext(baseURL ? { baseURL } : {});
  contexts.push(context);
  const page = await context.newPage();
  await watchCsp(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  return page;
}

async function signIn(page: Page, account: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const mySchedule = (page: Page) => nav(page).getByRole('link', { name: 'My schedule' });
const choosePerson = async (page: Page) => {
  await page.getByRole('combobox', { name: /Person/ }).click();
  await page.getByRole('option', { name: OWNER_NAME }).click();
};
const hoursGroup = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
async function pickTime(page: Page, name: string, time: string): Promise<void> {
  const [hour = '', minute = '', period = ''] = time.split(/[: ]/);
  const group = hoursGroup(page, name);
  await group.getByLabel('Hour').selectOption(hour);
  await group.getByLabel('Minute').selectOption(minute);
  await group.getByLabel('AM or PM').selectOption(period);
}
/** Chooses the next date, at least a week ahead, with this ISO weekday (1 = Monday). */
async function chooseDay(page: Page, weekday: number): Promise<void> {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  while ((date.getUTCDay() || 7) !== weekday) date.setUTCDate(date.getUTCDate() + 1);
  await page.getByLabel('Month').selectOption(String(date.getUTCMonth() + 1));
  await page.getByLabel('Day', { exact: true }).fill(String(date.getUTCDate()));
  await page.getByLabel('Year').fill(String(date.getUTCFullYear()));
}
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// eslint-disable-next-line no-empty-pattern -- Playwright needs the destructured first argument
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'creates a clinic: one browser is enough');
});
test.afterAll(async () => {
  for (const context of contexts) await context.close();
});

test('a platform admin creates a clinic, and its owner signs in', async ({ browser, baseURL }) => {
  const admin = await newPage(browser, baseURL);
  await signIn(admin, accounts.admin);
  await expect(admin.getByRole('heading', { level: 1, name: 'Platform overview' })).toBeVisible();
  await admin.goto('/admin/clinics/new');
  await admin.getByLabel('Clinic name').fill(CLINIC);
  await admin.getByLabel("Owner's full name").fill(OWNER_NAME);
  await admin.getByLabel("Owner's email").fill(OWNER_EMAIL);
  await admin.getByRole('button', { name: 'Create clinic' }).click();
  await expect(admin.getByRole('heading', { level: 1, name: CLINIC })).toBeVisible();

  owner = await newPage(browser, baseURL);
  await owner.goto(await findSetupLink({ to: OWNER_EMAIL }));
  await owner.getByLabel('New password').fill(OWNER_PASSWORD);
  await owner.getByRole('button', { name: 'Set up my account' }).click();
  await expect(owner.getByText('Your account is ready. Sign in to start.')).toBeVisible();
  await owner.getByLabel('Email').fill(OWNER_EMAIL);
  await owner.getByLabel('Password').fill(OWNER_PASSWORD);
  await owner.getByRole('button', { name: 'Sign in' }).click();
  await expect(owner.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
});

test('the owner makes themselves a practitioner, and "My schedule" appears', async () => {
  await nav(owner).getByRole('link', { name: 'Practitioners' }).click();
  await expect(owner.getByText('No practitioners yet')).toBeVisible();
  await expect(mySchedule(owner)).toHaveCount(0);
  await owner.getByRole('link', { name: 'Add a practitioner' }).first().click();
  await expect(owner.getByRole('heading', { level: 1, name: 'Add a practitioner' })).toBeVisible();
  await expectNoAxeViolations(owner);

  await owner.getByRole('button', { name: 'Add practitioner' }).click();
  await expect(owner.getByText('Choose the person.').first()).toBeVisible();

  // A second tab opens the same form before anyone is added (used for the duplicate check below).
  const other = await owner.context().newPage();
  await watchCsp(other);
  await other.goto('/practitioners/new');
  await expect(other.getByRole('combobox', { name: /Person/ })).toBeVisible();

  await choosePerson(owner);
  await expect(owner.getByLabel(/^Display name/)).toHaveValue(OWNER_NAME);
  await owner.getByLabel(/^Display name/).fill(DISPLAY_NAME);
  await owner.getByLabel(/^Specialization/).fill('Family Medicine');
  await expectNoAxeViolations(owner);
  await owner.getByRole('button', { name: 'Add practitioner' }).click();
  await expect(owner.getByRole('heading', { level: 1, name: DISPLAY_NAME })).toBeVisible();
  await expect(
    owner.getByText(`${DISPLAY_NAME} is now a practitioner at ${CLINIC}.`).first(),
  ).toBeVisible();
  await expect(owner.getByRole('main')).toContainText('Family Medicine');
  await expect(mySchedule(owner)).toBeVisible();
  profilePath = new URL(owner.url()).pathname;

  // The stale tab adds the same person again.
  await choosePerson(other);
  await other.getByRole('button', { name: 'Add practitioner' }).click();
  await expect(
    other.getByText('This person is already a practitioner here.').first(),
  ).toBeVisible();
  await expectNoAxeViolations(other);
  await other.getByRole('link', { name: 'Open their practitioner page' }).click();
  await other.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
  await expect(other.getByRole('heading', { level: 1, name: DISPLAY_NAME })).toBeVisible();
  await expectNoCspViolations(other);
  await other.close();
});

test('the owner edits the profile: only the change is saved, and a reload keeps it', async () => {
  await owner.goto(profilePath);
  await owner.getByRole('link', { name: 'Edit profile' }).click();
  await expect(owner.getByRole('heading', { level: 1, name: 'Edit practitioner' })).toBeVisible();
  await expectNoAxeViolations(owner);
  await owner.getByRole('button', { name: 'Save changes' }).click();
  await expect(owner.getByText('Nothing to change.')).toBeVisible();
  await owner.getByLabel(/^Specialization/).fill('Pediatrics');
  await owner.getByLabel(/^PTR number/).fill('PTR-E2E-1');
  await owner.getByRole('button', { name: 'Save changes' }).click();
  await expect(owner.getByRole('main')).toContainText('Pediatrics');
  await owner.reload();
  await expect(owner.getByRole('main')).toContainText('PTR-E2E-1');
});

test('the owner adds a second branch, and an overlap across the two is refused', async () => {
  await owner.goto('/clinic/branches/new');
  await owner.getByLabel('Branch name').fill(ANNEX);
  await owner.getByRole('button', { name: 'Add branch' }).click();
  await expect(owner.getByRole('heading', { level: 1, name: ANNEX })).toBeVisible();

  await owner.goto(profilePath);
  await owner.getByRole('link', { name: 'Edit weekly schedule' }).click();
  await expect(
    owner.getByRole('heading', { level: 1, name: 'Edit weekly schedule' }),
  ).toBeVisible();
  await expectNoAxeViolations(owner);

  const add = owner.getByRole('button', { name: 'Add hours on Monday' });
  await add.click();
  // Two active branches: none is chosen for the person.
  await expect(owner.getByLabel('Monday, hours 1: branch')).toHaveValue('');
  await owner.getByLabel('Monday, hours 1: branch').selectOption({ label: 'Main' });
  await pickTime(owner, 'Monday, hours 1: start', '9:00 AM');
  await pickTime(owner, 'Monday, hours 1: end', '12:00 PM');
  await add.click();
  await owner.getByLabel('Monday, hours 2: branch').selectOption({ label: ANNEX });
  await pickTime(owner, 'Monday, hours 2: start', '11:00 AM');
  await owner.getByRole('checkbox', { name: 'Monday, hours 2: until midnight' }).click();
  await owner.getByRole('button', { name: 'Save schedule' }).click();
  await expect(
    owner.getByText('These hours overlap other hours on this day.').first(),
  ).toBeVisible();
  await expectNoAxeViolations(owner);
});

test('copies Monday by keyboard, changes one copy, and saves the whole week', async () => {
  await pickTime(owner, 'Monday, hours 2: start', '1:00 PM');
  const copy = owner.getByRole('button', { name: "Copy Monday's hours to other days" });
  await copy.focus();
  await owner.keyboard.press('Enter');
  const dialog = owner.getByRole('dialog');
  for (const day of ['Tuesday', 'Thursday']) {
    await dialog.getByRole('checkbox', { name: day }).focus();
    await owner.keyboard.press('Space');
  }
  await expectNoAxeViolations(owner);
  await dialog.getByRole('button', { name: 'Copy hours' }).focus();
  await owner.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(copy).toBeFocused();
  await pickTime(owner, 'Tuesday, hours 1: end', '11:00 AM');
  await owner.getByRole('button', { name: 'Remove Tuesday, hours 2' }).click();
  await owner.getByRole('button', { name: 'Save schedule' }).click();
  await expect(owner.getByText('Weekly schedule saved.', { exact: true })).toBeVisible();

  await owner.reload();
  const week = owner.getByRole('region', { name: 'Weekly schedule' });
  const day = (name: string) =>
    week.getByRole('term').filter({ hasText: name }).locator('xpath=..').getByRole('definition');
  for (const name of ['Monday', 'Thursday']) {
    await expect(day(name)).toContainText('9:00 AM – 12:00 PM, Main');
    await expect(day(name)).toContainText(`1:00 PM – midnight, ${ANNEX}`);
  }
  await expect(day('Tuesday')).toContainText('9:00 AM – 11:00 AM, Main');
  await expect(day('Tuesday')).not.toContainText(ANNEX);
  await expect(day('Wednesday')).toContainText('No hours');

  const hours = owner.getByRole('region', { name: 'Working hours on a day' });
  await owner.getByLabel('Branch').selectOption({ label: 'Main' });
  await chooseDay(owner, 2);
  await expect(hours).toContainText('9:00 AM – 11:00 AM');
  await owner.getByLabel('Branch').selectOption({ label: ANNEX });
  await chooseDay(owner, 4);
  await expect(hours).toContainText('1:00 PM – midnight');
});

test('the schedule editor fits a phone screen, and an unchanged week sends nothing', async () => {
  await owner.setViewportSize({ width: 360, height: 800 });
  await owner.goto(`${profilePath}/schedule`);
  await expect(hoursGroup(owner, 'Thursday, hours 2: start')).toBeVisible();
  await expect.poll(() => overflow(owner)).toBeLessThanOrEqual(0);
  await expectNoAxeViolations(owner);
  await owner.getByRole('button', { name: "Copy Monday's hours to other days" }).click();
  await expect(owner.getByRole('dialog')).toBeVisible();
  await expect.poll(() => overflow(owner)).toBeLessThanOrEqual(0);
  await expectNoAxeViolations(owner);
  await owner.keyboard.press('Escape');
  await owner.getByRole('button', { name: 'Save schedule' }).click();
  await expect(owner.getByText('Nothing to change.')).toBeVisible();
  await owner.setViewportSize({ width: 1280, height: 800 });
});

test('deactivating hides them and "My schedule"; reactivating brings both back', async () => {
  await owner.goto(profilePath);
  await owner.getByRole('button', { name: 'Deactivate' }).click();
  const dialog = owner.getByRole('alertdialog');
  await expect(dialog).toContainText('will no longer be offered when booking. Nothing is deleted.');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expectNoAxeViolations(owner);
  await dialog.getByRole('button', { name: 'Deactivate' }).click();
  await expect(owner.getByText('This practitioner is inactive.', { exact: true })).toBeVisible();
  await expect(owner.getByText('No working hours: this practitioner is inactive.')).toBeVisible();
  await expect(mySchedule(owner)).toHaveCount(0);
  await nav(owner).getByRole('link', { name: 'Practitioners' }).click();
  await expect(owner.getByRole('row', { name: /E2E Owner/ })).toContainText('Inactive');

  await owner.getByRole('link', { name: DISPLAY_NAME }).click();
  await owner.getByRole('button', { name: 'Reactivate' }).click();
  await expect(owner.getByRole('button', { name: 'Deactivate' })).toBeVisible();
  await expect(owner.getByText('This practitioner is inactive.', { exact: true })).toHaveCount(0);
  await expect(mySchedule(owner)).toBeVisible();
});

test('the forms fit a phone screen', async () => {
  await owner.setViewportSize({ width: 360, height: 800 });
  await owner.goto(`${profilePath}/edit`);
  await expect(owner.getByRole('heading', { level: 1, name: 'Edit practitioner' })).toBeVisible();
  await expect.poll(() => overflow(owner)).toBeLessThanOrEqual(0);
  await expectNoAxeViolations(owner);
  await owner.goto('/practitioners/new');
  await expect(owner.getByText('Everyone on your staff is already a practitioner.')).toBeVisible();
  await expect.poll(() => overflow(owner)).toBeLessThanOrEqual(0);
  await expectNoAxeViolations(owner);
  await owner.setViewportSize({ width: 1280, height: 800 });
  await expectNoCspViolations(owner);
});

test('another clinic cannot open the profile', async ({ browser, baseURL }) => {
  const sunrise = await newPage(browser, baseURL);
  await signIn(sunrise, accounts.owner);
  await expect(sunrise.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
  for (const path of [profilePath, `${profilePath}/edit`, `${profilePath}/schedule`]) {
    await sunrise.goto(path);
    await expect(
      sunrise.getByRole('heading', { level: 1, name: 'We could not find this practitioner' }),
    ).toBeVisible();
    await expect(sunrise.getByText(DISPLAY_NAME)).toHaveCount(0);
  }
});
