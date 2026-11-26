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

// Adding, editing, deactivating and reactivating a service against the real API
// (plans/08-services-catalog.md, sub-phase 8.2).
//
// The changes are made in a clinic this spec creates (a platform admin creates it, its owner sets up
// the account from the emailed link), never in Sunrise: services cannot be deleted, so each run leaves
// one "E2E Services ..." clinic with its services. Each account signs in once per run. The API must
// run with MAIL_TRANSPORT=file and its CORS_ALLOWED_ORIGINS and APP_PUBLIC_URL set to the preview
// origin (http://localhost:4173).
test.describe.configure({ mode: 'serial' });

const STAMP = Date.now();
const CLINIC = `E2E Services ${STAMP}`;
const OWNER_EMAIL = `e2e-services-${STAMP}@example.test`;
const OWNER_PASSWORD = 'an-e2e-owner-password-2026';
const SERVICE = 'E2E Follow-up';
const DEFAULT = 'General consultation';

const contexts: BrowserContext[] = [];
let owner: Page;
let servicePath = '';

async function newPage(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext(baseURL ? { baseURL } : {});
  contexts.push(context);
  const page = await context.newPage();
  await watchCsp(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  return page;
}

const row = (page: Page, name: string) =>
  page.getByRole('row').filter({ has: page.getByRole('link', { name, exact: true }) });
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name });
const main = (page: Page) => page.getByRole('main');
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const save = (page: Page) => page.getByRole('button', { name: 'Save changes' }).click();

async function edit(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(heading(page, 'Edit service')).toBeVisible();
}

// eslint-disable-next-line no-empty-pattern -- Playwright needs the destructured first argument
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'creates a clinic: one browser is enough');
});
test.afterEach(async () => {
  // The owner's page exists from the second context on.
  if (contexts.length > 1) await expectNoCspViolations(owner);
});
test.afterAll(async () => {
  for (const context of contexts) await context.close();
});

test('a new clinic starts with General consultation', async ({ browser, baseURL }) => {
  const admin = await newPage(browser, baseURL);
  await admin.goto('/login');
  await admin.getByLabel('Email').fill(accounts.admin.email);
  await admin.getByLabel('Password').fill(accounts.admin.password);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await expect(heading(admin, 'Platform overview')).toBeVisible();
  await admin.goto('/admin/clinics/new');
  await admin.getByLabel('Clinic name').fill(CLINIC);
  await admin.getByLabel("Owner's full name").fill('E2E Services Owner');
  await admin.getByLabel("Owner's email").fill(OWNER_EMAIL);
  await admin.getByRole('button', { name: 'Create clinic' }).click();
  await expect(heading(admin, CLINIC)).toBeVisible();

  owner = await newPage(browser, baseURL);
  await owner.goto(await findSetupLink({ to: OWNER_EMAIL }));
  await owner.getByLabel('New password').fill(OWNER_PASSWORD);
  await owner.getByRole('button', { name: 'Set up my account' }).click();
  await expect(owner.getByText('Your account is ready. Sign in to start.')).toBeVisible();
  await owner.getByLabel('Email').fill(OWNER_EMAIL);
  await owner.getByLabel('Password').fill(OWNER_PASSWORD);
  await owner.getByRole('button', { name: 'Sign in' }).click();
  await expect(owner.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();

  await owner.goto('/clinic/services');
  await expect(row(owner, DEFAULT)).toContainText('30 minutes');
  await expect(row(owner, DEFAULT)).toContainText('Price at the desk');
});

test('adds a service with a price typed with a comma, kept after a reload', async () => {
  await owner.getByRole('link', { name: 'Add a service' }).click();
  await expect(heading(owner, 'Add a service')).toBeVisible();
  await owner.getByRole('button', { name: 'Add service' }).click();
  await expect(owner.getByText('Enter the service name.').first()).toBeVisible();
  await owner.getByLabel('Service name').fill(SERVICE);
  await owner.getByLabel('Usual length, in minutes').fill('15');
  await owner.getByRole('radio', { name: 'Fixed price', exact: true }).click();
  await owner.getByLabel('Amount').fill('1,250.50');
  await expectNoAxeViolations(owner);
  await owner.getByRole('button', { name: 'Add service' }).click();
  await expect(heading(owner, SERVICE)).toBeVisible();
  await expect(owner.getByText(`${SERVICE} added.`).first()).toBeVisible();
  servicePath = new URL(owner.url()).pathname;
  await owner.reload();
  await expect(main(owner)).toContainText('₱1,250.50');
  await expect(main(owner)).toContainText('15 minutes');
  await expect(main(owner)).toContainText('No description');
});

test('refuses the same name in other letters, under Name', async () => {
  await owner.goto('/clinic/services/new');
  await owner.getByLabel('Service name').fill(SERVICE.toLowerCase());
  await owner.getByRole('button', { name: 'Add service' }).click();
  await expect(
    owner.getByText('This clinic already has a service with this name.').first(),
  ).toBeVisible();
  await expect(owner.getByLabel('Service name')).toHaveAttribute('aria-invalid', 'true');
  await expectNoAxeViolations(owner);
  await owner.getByRole('link', { name: 'Cancel' }).click();
  await owner.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
  await expect(row(owner, SERVICE)).toContainText('₱1,250.50');
});

test('edits the price to Free, then no fixed price, and the default service too', async () => {
  await owner.goto(servicePath);
  await edit(owner);
  await expect(owner.getByLabel('Amount')).toHaveValue('1,250.50');
  await save(owner);
  await expect(owner.getByText('Nothing to change.')).toBeVisible();
  await owner.getByRole('radio', { name: 'Free' }).click();
  await save(owner);
  await expect(heading(owner, SERVICE)).toBeVisible();
  await expect(main(owner)).toContainText('Free');
  await edit(owner);
  await owner.getByRole('radio', { name: 'No fixed price' }).click();
  await owner.getByLabel(/^Description/).fill('A second visit.');
  await save(owner);
  await expect(main(owner)).toContainText('Price at the desk');
  await owner.reload();
  await expect(main(owner)).toContainText('A second visit.');
  await expect(main(owner)).toContainText('Price at the desk');

  await owner.goto('/clinic/services');
  await owner.getByRole('link', { name: DEFAULT }).click();
  await edit(owner);
  // The other service's name is taken.
  await owner.getByLabel('Service name').fill(SERVICE);
  await save(owner);
  await expect(
    owner.getByText('This clinic already has a service with this name.').first(),
  ).toBeVisible();
  await owner.getByLabel('Service name').fill(DEFAULT);
  await owner.getByRole('radio', { name: 'Fixed price', exact: true }).click();
  await owner.getByLabel('Amount').fill('500');
  await save(owner);
  await expect(main(owner)).toContainText('₱500.00');
});

test('deactivates it, finds it again with Show inactive, and reactivates it', async () => {
  await owner.goto(servicePath);
  await owner.getByRole('button', { name: 'Deactivate' }).click();
  const dialog = owner.getByRole('alertdialog');
  await expect(dialog).toContainText('past records keep its name');
  await expectNoAxeViolations(owner);
  await dialog.getByRole('button', { name: 'Deactivate' }).click();
  await expect(owner.getByText('This service is inactive.', { exact: false })).toBeVisible();

  await owner.goto('/clinic/services');
  await expect(row(owner, DEFAULT)).toBeVisible();
  await expect(owner.getByRole('link', { name: SERVICE })).toHaveCount(0);
  await owner.getByRole('checkbox', { name: 'Show inactive services' }).click();
  await expect(row(owner, SERVICE)).toContainText('Inactive');
  await owner.getByRole('link', { name: SERVICE }).click();
  await expect(heading(owner, SERVICE)).toBeVisible();
  await owner.getByRole('button', { name: 'Reactivate' }).click();
  await expect(owner.getByText('This service is inactive.', { exact: false })).toHaveCount(0);
  await owner.goto('/clinic/services');
  await expect(row(owner, SERVICE)).toContainText('Active');
});

test('the add and edit forms fit a phone screen', async () => {
  await owner.setViewportSize({ width: 360, height: 800 });
  await owner.goto('/clinic/services/new');
  await owner.getByRole('radio', { name: 'Fixed price', exact: true }).click();
  await expect(owner.getByLabel('Amount')).toBeVisible();
  await expect.poll(() => overflow(owner)).toBeLessThanOrEqual(0);
  await expectNoAxeViolations(owner);
  await owner.getByRole('link', { name: 'Cancel' }).click();
  await owner.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
  await owner.goto(servicePath);
  await expect.poll(() => overflow(owner)).toBeLessThanOrEqual(0);
  await edit(owner);
  await expect.poll(() => overflow(owner)).toBeLessThanOrEqual(0);
  await expectNoAxeViolations(owner);
});
