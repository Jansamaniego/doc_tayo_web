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

// The Clinic tab (profile and branches) against the real API (plans/05-staff-and-account.md, 5.6).
//
// The changes are made in a clinic this spec creates (a platform admin creates it, its owner sets up
// the account from the emailed link), so the seeded Sunrise Clinic is never changed: the seeded
// receptionist and owner only read it. Clinics, accounts and branches cannot be deleted, so each run
// leaves a deactivated-by-nobody "E2E Clinic ..." with one branch behind. Each account signs in once per
// run (the API allows 5 per 15 minutes per account). The API must run with MAIL_TRANSPORT=file and its
// CORS_ALLOWED_ORIGINS and APP_PUBLIC_URL set to the preview origin (http://localhost:4173).
test.describe.configure({ mode: 'serial' });

const API_ORIGIN = process.env.VITE_API_ORIGIN ?? 'http://localhost:3000';
const STAMP = Date.now();
const CLINIC = `E2E Clinic ${STAMP}`;
const RENAMED_CLINIC = `E2E Renamed ${STAMP}`;
const OWNER_EMAIL = `e2e-owner-${STAMP}@example.test`;
const OWNER_PASSWORD = 'an-e2e-owner-password-2026';
const BRANCH = `E2E Branch ${STAMP}`;

const contexts: BrowserContext[] = [];
let owner: Page;
let branchUrl = '';

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

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const clinicTabs = (page: Page) => page.getByRole('navigation', { name: 'Clinic sections' });

// eslint-disable-next-line no-empty-pattern -- Playwright needs the destructured first argument
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'creates a clinic: one browser is enough');
});
test.afterAll(async () => {
  for (const context of contexts) await context.close();
});

test('a platform admin creates a clinic, and its new owner sets up the account and signs in', async ({
  browser,
  baseURL,
}) => {
  const admin = await newPage(browser, baseURL);
  await signIn(admin, accounts.admin);
  await expect(admin.getByRole('heading', { level: 1, name: 'Platform overview' })).toBeVisible();
  await admin.goto('/admin/clinics/new');
  await admin.getByLabel('Clinic name').fill(CLINIC);
  await admin.getByLabel("Owner's full name").fill('E2E Owner');
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

test('a receptionist reads the clinic and its branches, and cannot change anything', async ({
  browser,
  baseURL,
}) => {
  const reception = await newPage(browser, baseURL);
  await signIn(reception, accounts.receptionist);
  await expect(reception.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
  await expect(mainNav(reception).getByRole('link', { name: 'Staff' })).toHaveCount(0);

  await mainNav(reception).getByRole('link', { name: 'Clinic' }).click();
  await expect(reception.getByRole('heading', { level: 1, name: 'Clinic' })).toBeVisible();
  await expect(reception.getByText('Sunrise Clinic').first()).toBeVisible();
  await expect(reception.getByRole('button', { name: 'Edit details' })).toHaveCount(0);
  await expect(
    reception.getByText("Only an owner or clinic admin can change the clinic's details."),
  ).toBeVisible();
  await expectNoAxeViolations(reception);

  await clinicTabs(reception).getByRole('link', { name: 'Branches' }).click();
  // The seeded branch is "Main"; a developer may have renamed it, so match the start of the name.
  await expect(reception.getByRole('link', { name: /^Main/ })).toBeVisible();
  await expect(reception.getByRole('link', { name: 'Quezon City Annex' })).toBeVisible();
  await expect(reception.getByRole('link', { name: 'Add branch' })).toHaveCount(0);
  await reception.getByRole('link', { name: /^Main/ }).click();
  await expect(reception.getByRole('heading', { level: 1, name: /^Main/ })).toBeVisible();
  await expect(reception.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(reception.getByRole('button', { name: 'Deactivate' })).toHaveCount(0);
  await expect(
    reception.getByText('Only an owner or clinic admin can change branches.'),
  ).toBeVisible();

  await reception.goto('/clinic/branches/new');
  await expect(
    reception.getByRole('heading', { level: 1, name: "You don't have access to this page" }),
  ).toBeVisible();

  // The server refuses too: a direct PATCH with the receptionist's own token answers 403.
  const status = await reception.evaluate(async (apiOrigin) => {
    const refreshed = await fetch(`${apiOrigin}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    const { data } = (await refreshed.json()) as { data: { accessToken: string } };
    const answer = await fetch(`${apiOrigin}/api/v1/tenant`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${data.accessToken}` },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    return answer.status;
  }, API_ORIGIN);
  expect(status).toBe(403);
  await expectNoCspViolations(reception);
});

test("the owner edits the clinic's contact details, and a reload keeps them", async () => {
  await mainNav(owner).getByRole('link', { name: 'Clinic' }).click();
  await expect(owner.getByRole('heading', { level: 1, name: 'Clinic' })).toBeVisible();
  await expect(owner.getByText('Not set')).toHaveCount(2);
  await owner.getByRole('button', { name: 'Edit details' }).click();
  await expectNoAxeViolations(owner);

  await owner.getByLabel('Contact phone').fill('0917 123 4567');
  await owner.getByRole('button', { name: 'Save' }).click();
  await expect(
    owner
      .getByText('Enter the phone number with its country code, for example +639171234567.')
      .first(),
  ).toBeVisible();

  await owner.getByLabel('Contact email').fill(`hello-${STAMP}@example.test`);
  await owner.getByLabel('Contact phone').fill('+63 917 123 4567');
  await owner.getByRole('button', { name: 'Save' }).click();
  await expect(owner.getByText('Clinic details saved.', { exact: true })).toBeVisible();
  await expect(owner.getByText('+639171234567')).toBeVisible();

  await owner.reload();
  await expect(owner.getByText(`hello-${STAMP}@example.test`)).toBeVisible();
  await expect(owner.getByText('+639171234567')).toBeVisible();
});

test('the owner renames the clinic, and the name changes at the top without a reload', async () => {
  await owner.getByRole('button', { name: 'Edit details' }).click();
  await owner.getByLabel('Clinic name').fill(RENAMED_CLINIC);
  await owner.getByRole('button', { name: 'Save' }).click();
  await expect(owner.getByText('Clinic details saved.', { exact: true })).toBeVisible();
  await expect(owner.getByText(RENAMED_CLINIC).first()).toBeVisible();
  await expect(owner.getByText(CLINIC, { exact: true })).toHaveCount(0);
  await expect(owner.getByRole('banner').getByText(RENAMED_CLINIC).first()).toBeVisible();
});

test('the owner changes the time zone after a confirmation, and dates elsewhere follow', async () => {
  await owner.getByRole('button', { name: 'Edit details' }).click();
  await owner.getByRole('combobox', { name: 'Time zone' }).click();
  await owner.getByRole('option', { name: 'Asia/Tokyo' }).click();
  await owner.getByRole('button', { name: 'Save' }).click();
  const dialog = owner.getByRole('alertdialog');
  await expect(dialog).toContainText(
    `Dates and times for ${RENAMED_CLINIC} will show in Asia/Tokyo`,
  );
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expectNoAxeViolations(owner);
  await dialog.getByRole('button', { name: 'Change time zone' }).click();
  await expect(owner.getByText('Clinic details saved.', { exact: true })).toBeVisible();
  await expect(owner.getByText('Asia/Tokyo').first()).toBeVisible();

  await mainNav(owner).getByRole('link', { name: 'Staff' }).click();
  await expect(owner.getByText('Dates are shown in Asia/Tokyo.')).toBeVisible();
});

test('the owner adds, edits, deactivates and reactivates a branch', async () => {
  await mainNav(owner).getByRole('link', { name: 'Clinic' }).click();
  await clinicTabs(owner).getByRole('link', { name: 'Branches' }).click();
  // A new clinic starts with one branch, "Main", which has no time zone of its own.
  await expect(owner.getByRole('link', { name: 'Main', exact: true })).toBeVisible();
  await expect(owner.getByText("Clinic's (Asia/Tokyo)")).toBeVisible();
  await owner.getByRole('link', { name: 'Add branch' }).first().click();
  await expect(owner.getByRole('heading', { level: 1, name: 'Add a branch' })).toBeVisible();
  await expect(
    owner.getByText("Leave empty to use the clinic's time zone (Asia/Tokyo)."),
  ).toBeVisible();
  await expectNoAxeViolations(owner);
  await owner.getByLabel('Branch name').fill(BRANCH);
  await owner.getByRole('button', { name: 'Add branch' }).click();
  await expect(owner.getByRole('heading', { level: 1, name: BRANCH })).toBeVisible();
  branchUrl = owner.url();

  // A second branch with the same name is refused on the name field.
  await owner.goto('/clinic/branches/new');
  await owner.getByLabel('Branch name').fill(BRANCH);
  await owner.getByRole('button', { name: 'Add branch' }).click();
  await expect(
    owner.getByText('Your clinic already has a branch with this name.').first(),
  ).toBeVisible();

  await owner.goto(branchUrl);
  await owner.getByRole('button', { name: 'Edit' }).click();
  await owner.getByLabel('City').fill('Cebu City');
  await owner.getByRole('button', { name: 'Save' }).click();
  await expect(owner.getByText('Branch details saved.', { exact: true })).toBeVisible();
  await expect(owner.getByText('Cebu City')).toBeVisible();
  await expect(owner.getByText("Clinic's (Asia/Tokyo)")).toBeVisible();

  await owner.getByRole('button', { name: 'Deactivate' }).click();
  const dialog = owner.getByRole('alertdialog');
  await expect(dialog).toContainText(
    `${BRANCH} will no longer be offered when staff choose a branch`,
  );
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Deactivate' }).click();
  await expect(owner.getByText(`${BRANCH} was deactivated.`, { exact: true })).toBeVisible();

  await owner.getByRole('link', { name: 'All branches' }).click();
  await expect(owner.getByRole('link', { name: 'Main', exact: true })).toBeVisible();
  await expect(owner.getByRole('link', { name: BRANCH })).toHaveCount(0);
  await owner.getByLabel('Show').selectOption('inactive');
  await expect(owner).toHaveURL(/status=inactive/);
  await expect(owner.getByRole('link', { name: BRANCH })).toBeVisible();
  await expect(owner.getByRole('link', { name: 'Main', exact: true })).toHaveCount(0);

  await owner.getByRole('link', { name: BRANCH }).click();
  await owner.getByRole('button', { name: 'Reactivate' }).click();
  await expect(owner.getByText(`${BRANCH} is active again.`, { exact: true })).toBeVisible();
  await expect(owner.getByRole('button', { name: 'Deactivate' })).toBeVisible();
});

test("another clinic's branch is not found, and Sunrise's owner is sent back to the list", async ({
  browser,
  baseURL,
}) => {
  expect(branchUrl).not.toBe('');
  const sunriseOwner = await newPage(browser, baseURL);
  await signIn(sunriseOwner, accounts.owner);
  await expect(sunriseOwner.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
  await sunriseOwner.goto(new URL(branchUrl).pathname);
  await expect(sunriseOwner.getByText('This branch is not in your clinic.')).toBeVisible();
  await expect(sunriseOwner).toHaveURL(/\/clinic\/branches\?notice=missing/);
  await expect(sunriseOwner.getByRole('link', { name: BRANCH })).toHaveCount(0);
});

// One page load per width, then clicks: the API limits page loads (30 refreshes a minute per address).
for (const width of [1280, 360]) {
  test(`every clinic page has no accessibility violations and no sideways scrolling at ${String(width)} px`, async () => {
    await owner.setViewportSize({ width, height: 800 });
    async function checkPage(heading: string): Promise<void> {
      await expect(owner.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expectNoAxeViolations(owner);
      const scrollsSideways = await owner.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(scrollsSideways, `"${heading}" scrolls sideways at ${String(width)} px`).toBe(false);
    }

    await owner.goto('/clinic');
    await checkPage('Clinic');
    await clinicTabs(owner).getByRole('link', { name: 'Branches' }).click();
    await checkPage('Clinic');
    await owner.getByRole('link', { name: 'Add branch' }).first().click();
    await checkPage('Add a branch');
    await owner.getByRole('link', { name: 'All branches' }).click();
    await owner.getByRole('link', { name: BRANCH }).click();
    await checkPage(BRANCH);
  });
}
