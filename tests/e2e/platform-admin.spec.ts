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

// The platform admin tabs against the real API (plans/04-platform-admin.md, M5).
//
// These specs CREATE a clinic and an owner account, so they run in one browser (Chromium), one after
// another, sharing one signed-in page: the API allows 5 sign-ins per 15 minutes per account. Clinics
// cannot be deleted, so every run leaves a deactivated "E2E Clinic ..." behind.
// The API must run with MAIL_TRANSPORT=file (the setup email is read from its var/mail) and its
// CORS_ALLOWED_ORIGINS and APP_PUBLIC_URL must be the preview origin (http://localhost:4173).
test.describe.configure({ mode: 'serial' });

const API_ORIGIN = process.env.VITE_API_ORIGIN ?? 'http://localhost:3000';
const STAMP = Date.now();
const CLINIC = `E2E Clinic ${STAMP}`;
const SLUG = `e2e-clinic-${STAMP}`;
const OWNER_NAME = 'E2E Owner';
const OWNER_EMAIL = `e2e-owner-${STAMP}@example.test`;
const OWNER_PASSWORD = 'an-e2e-owner-password-2026';

let adminContext: BrowserContext | undefined;
let admin: Page;
let clinicUrl = '';

async function newPage(
  browser: Browser,
  baseURL: string | undefined,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(baseURL ? { baseURL } : {});
  const page = await context.newPage();
  await watchCsp(page);
  return { context, page };
}

async function signIn(page: Page, account: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.beforeAll(async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'creates data: one browser is enough');
  const created = await newPage(browser, baseURL);
  adminContext = created.context;
  admin = created.page;
  await admin.setViewportSize({ width: 1280, height: 800 });
  await signIn(admin, accounts.admin);
  await expect(admin.getByRole('heading', { level: 1, name: 'Platform overview' })).toBeVisible();
});

// After each test, so a violation points at the screen that caused it.
test.afterEach(async () => {
  await expectNoCspViolations(admin);
});

test.afterAll(async () => {
  // Undefined when the project was skipped.
  await adminContext?.close();
});

test('a platform admin lands on the platform overview: only the platform tabs, no clinic picker', async () => {
  await expect(admin).toHaveURL(/\/admin$/);
  const nav = admin.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Clinics' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Users' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveCount(0);
  await expect(admin.getByText('Choose a clinic')).toHaveCount(0);
  await expect(admin.getByText('The service is ready')).toBeVisible();
  await expect(admin.getByText('Sample data')).toBeVisible();
  await expectNoAxeViolations(admin);
});

test('the overview counts every clinic, and agrees with the Clinics list', async () => {
  const block = admin.getByRole('region', { name: 'Clinics at a glance' });
  const all = block.getByRole('link', { name: /All clinics/ });
  await expect(all).toHaveText(/\d/);
  const total = (await all.innerText()).replace(/\D/g, '');
  const active = (await block.getByRole('link', { name: /Active/ }).innerText()).replace(/\D/g, '');
  const suspended = (await block.getByRole('link', { name: /Suspended/ }).innerText()).replace(
    /\D/g,
    '',
  );
  const deactivated = (await block.getByRole('link', { name: /Deactivated/ }).innerText()).replace(
    /\D/g,
    '',
  );
  expect(Number(active) + Number(suspended) + Number(deactivated)).toBe(Number(total));
  await all.click();
  await expect(admin.getByText(`${total} clinics found`)).toBeVisible();
  // The tile's own filter reaches the list.
  await admin.goBack();
  await admin
    .getByRole('region', { name: 'Clinics at a glance' })
    .getByRole('link', { name: /Deactivated/ })
    .click();
  await expect(admin).toHaveURL(/status=deactivated/);
  await expect(admin.getByLabel('Status')).toHaveValue('deactivated');
  await expect(admin.getByText(`${deactivated} clinics found`)).toBeVisible();
  await admin
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Overview' })
    .click();
  await expect(admin.getByRole('heading', { level: 1, name: 'Platform overview' })).toBeVisible();
});

test('creates a clinic with a new owner and opens it', async () => {
  await admin
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Clinics' })
    .click();
  await admin.getByRole('link', { name: 'New clinic' }).first().click();
  await expect(admin.getByRole('heading', { level: 1, name: 'New clinic' })).toBeVisible();
  await expectNoAxeViolations(admin);
  await admin.getByLabel('Clinic name').fill(CLINIC);
  await expect(admin.getByLabel('Web address name')).toHaveValue(SLUG);
  await admin.getByLabel("Owner's full name").fill(OWNER_NAME);
  await admin.getByLabel("Owner's email").fill(OWNER_EMAIL);
  await admin.getByRole('button', { name: 'Create clinic' }).click();
  await expect(admin.getByRole('heading', { level: 1, name: CLINIC })).toBeVisible();
  await expect(admin.getByText(`We emailed ${OWNER_EMAIL}`).first()).toBeVisible();
  await expect(admin.getByText(OWNER_EMAIL).first()).toBeVisible();
  clinicUrl = admin.url();
  await expectNoAxeViolations(admin);
});

test('the new owner opens the emailed link, sets a password, and signs in to their clinic', async ({
  browser,
  baseURL,
}) => {
  const link = await findSetupLink({ to: OWNER_EMAIL });
  const { context, page } = await newPage(browser, baseURL);
  await page.goto(link);
  await expect(page.getByRole('heading', { level: 1, name: 'Set up your account' })).toBeVisible();
  // The token is read once and removed from the address bar.
  await expect(page).not.toHaveURL(/token=/);
  await page.getByLabel('New password').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Set up my account' }).click();
  await expect(page.getByText('Your account is ready. Sign in to start.')).toBeVisible();
  await page.getByLabel('Email').fill(OWNER_EMAIL);
  await page.getByLabel('Password').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
  await expect(page.getByText(CLINIC).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Clinics' })).toHaveCount(0);
  await expectNoCspViolations(page);
  await context.close();
});

test('suspends and reactivates the clinic, each after a confirmation', async () => {
  await admin.goto(clinicUrl);
  await expect(admin.getByRole('heading', { level: 1, name: CLINIC })).toBeVisible();
  await admin.getByRole('button', { name: 'Suspend' }).click();
  const dialog = admin.getByRole('alertdialog');
  await expect(dialog).toContainText(`Everyone at ${CLINIC} loses access until you reactivate it`);
  await expectNoAxeViolations(admin);
  await dialog.getByRole('button', { name: 'Suspend' }).click();
  await expect(admin.getByRole('button', { name: 'Reactivate' })).toBeVisible();
  await expect(admin.getByText('Suspended').first()).toBeVisible();
  await admin.getByRole('button', { name: 'Reactivate' }).click();
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Reactivate' }).click();
  await expect(admin.getByRole('button', { name: 'Suspend' })).toBeVisible();
});

test('finds the clinic in the list by its web address name, with the search text kept out of the address', async () => {
  await admin.goto('/admin/clinics');
  await admin.getByRole('searchbox', { name: 'Search clinics' }).fill(SLUG);
  await admin.keyboard.press('Enter');
  await expect(admin.getByRole('link', { name: CLINIC })).toBeVisible();
  expect(admin.url()).not.toContain(SLUG);
  await admin.getByLabel('Status').selectOption('Active');
  await expect(admin).toHaveURL(/status=active/);
  await expectNoAxeViolations(admin);
});

test('refuses a web address name that is already used, and keeps what was typed', async () => {
  await admin.goto('/admin/clinics/new');
  await admin.getByLabel('Clinic name').fill(`E2E Clash ${STAMP}`);
  await admin.getByLabel('Web address name').fill(SLUG);
  await admin.getByLabel("Owner's full name").fill('Clash Owner');
  await admin.getByLabel("Owner's email").fill(`e2e-clash-${STAMP}@example.test`);
  await admin.getByRole('button', { name: 'Create clinic' }).click();
  await expect(
    admin.getByText('This web address name is already used. Choose another.').first(),
  ).toBeVisible();
  await expect(admin.getByLabel('Clinic name')).toHaveValue(`E2E Clash ${STAMP}`);
  await expectNoAxeViolations(admin);
});

test('deactivates the clinic only after typing its web address name, and then offers nothing', async () => {
  await admin.goto(clinicUrl);
  await admin.getByRole('button', { name: 'Deactivate' }).click();
  const dialog = admin.getByRole('alertdialog');
  await expect(dialog).toContainText('This cannot be undone.');
  // Not typed yet: the button is unavailable (aria-disabled), so Playwright must be told to press it anyway.
  await dialog.getByRole('button', { name: 'Deactivate' }).click({ force: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(`Type ${SLUG} to confirm`).fill(SLUG);
  await dialog.getByRole('button', { name: 'Deactivate' }).click();
  await expect(admin.getByText(/Deactivation is permanent/)).toBeVisible();
  await expect(admin.getByRole('button', { name: /Suspend|Reactivate|Deactivate/ })).toHaveCount(0);
});

test('deactivates the owner account: sign-in is refused until it is reactivated', async ({
  browser,
  baseURL,
}) => {
  await admin.goto('/admin/users');
  await admin.getByRole('searchbox', { name: 'Search users' }).fill(OWNER_EMAIL);
  await admin.keyboard.press('Enter');
  expect(admin.url()).not.toContain('example.test');
  // The list still shows the previous results until the search answers: wait for it to narrow.
  await expect(admin.getByRole('link', { name: OWNER_NAME })).toHaveCount(1);
  await admin.getByRole('link', { name: OWNER_NAME }).click();
  await expect(admin.getByRole('heading', { level: 1, name: OWNER_NAME })).toBeVisible();
  await admin.getByRole('button', { name: 'Deactivate' }).click();
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Deactivate' }).click();
  await expect(admin.getByRole('button', { name: 'Reactivate' })).toBeVisible();

  const { context, page } = await newPage(browser, baseURL);
  await signIn(page, { email: OWNER_EMAIL, password: OWNER_PASSWORD });
  await expect(page.getByRole('alert').first()).toContainText(
    'The email or password is incorrect.',
  );
  await context.close();

  await admin.getByRole('button', { name: 'Reactivate' }).click();
  await admin.getByRole('alertdialog').getByRole('button', { name: 'Reactivate' }).click();
  await expect(admin.getByRole('button', { name: 'Deactivate' })).toBeVisible();
  await expectNoAxeViolations(admin);
});

test('has no status buttons on your own account', async () => {
  await admin.goto('/admin/users');
  await admin.getByRole('searchbox', { name: 'Search users' }).fill(accounts.admin.email);
  await admin.keyboard.press('Enter');
  const row = admin.getByRole('row', { name: new RegExp(accounts.admin.email) });
  await expect(row).toHaveCount(1);
  await row.getByRole('link').click();
  await expect(admin.getByText('You cannot change the status of your own account.')).toBeVisible();
  await expect(admin.getByRole('button', { name: /Deactivate|Reactivate/ })).toHaveCount(0);
});

test('the admin screens reflow at 360 px with no sideways scrolling', async () => {
  await admin.setViewportSize({ width: 360, height: 800 });
  for (const path of [
    '/admin',
    '/admin/clinics',
    '/admin/clinics/new',
    '/admin/users',
    clinicUrl,
  ]) {
    await admin.goto(path);
    await expect(admin.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await admin.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
      `${path} scrolls sideways`,
    ).toBe(false);
    await expectNoAxeViolations(admin);
  }
  await admin.setViewportSize({ width: 1280, height: 800 });
});

test('a receptionist has no admin tabs, sees "page not found" at /admin, and the API refuses them', async ({
  browser,
  baseURL,
}) => {
  const { context, page } = await newPage(browser, baseURL);
  await signIn(page, accounts.receptionist);
  await expect(page.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Clinics' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
  await page.goto('/admin/clinics');
  await expect(
    page.getByRole('heading', { level: 1, name: 'We could not find this page' }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  await expectNoCspViolations(page);
  await context.close();

  // The server refuses a clinic user's token on /admin/* whatever the screen shows.
  const login = await admin.request.post(`${API_ORIGIN}/api/v1/auth/login`, {
    data: accounts.receptionist,
  });
  const { data } = (await login.json()) as { data: { accessToken: string } };
  const refused = await admin.request.get(`${API_ORIGIN}/api/v1/admin/tenants`, {
    headers: { authorization: `Bearer ${data.accessToken}` },
  });
  expect(refused.status()).toBe(403);
});
