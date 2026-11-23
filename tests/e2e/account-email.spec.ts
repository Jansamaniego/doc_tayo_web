import type { Browser, BrowserContext, Page } from '@playwright/test';

import { accounts } from './fixtures/accounts.ts';
import { findEmailLink } from './fixtures/mail.ts';
import {
  expect,
  expectNoAxeViolations,
  expectNoCspViolations,
  test,
  watchCsp,
} from './fixtures/test.ts';

// The account page against the real API (plans/05-staff-and-account.md, sub-phase 5.4): rename and
// change the email end to end. It never touches a seeded account: it invites a NEW person (the owner
// signs in once), accepts the invitation from the emailed link, and changes that person's name and
// email. Accounts cannot be deleted, so every run leaves one "e2e-acct-...@example.test" account.
// The API must run with MAIL_TRANSPORT=file (the links are read from its var/mail) and its
// CORS_ALLOWED_ORIGINS and APP_PUBLIC_URL must be the preview origin (http://localhost:4173).
test.describe.configure({ mode: 'serial' });

const STAMP = Date.now();
const OLD_EMAIL = `e2e-acct-${STAMP}@example.test`;
const NEW_EMAIL = `e2e-acct-${STAMP}-new@example.test`;
const PASSWORD = 'an-e2e-person-password-2026';
const FIRST_NAME = 'E2E Person';
const NEW_NAME = 'E2E Renamed Person';

let contexts: BrowserContext[] = [];
let person: Page;
let verifyLink = '';

async function newPage(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext(baseURL ? { baseURL } : {});
  contexts.push(context);
  const page = await context.newPage();
  await watchCsp(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  return page;
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.beforeAll(async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'creates data: one browser is enough');
  contexts = [];

  // The owner invites a new person...
  const owner = await newPage(browser, baseURL);
  await owner.goto('/login');
  await owner.getByLabel('Email').fill(accounts.owner.email);
  await owner.getByLabel('Password').fill(accounts.owner.password);
  await owner.getByRole('button', { name: 'Sign in' }).click();
  await expect(owner.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
  await owner.goto('/staff/invitations');
  await owner.getByRole('button', { name: 'Invite someone' }).click();
  const dialog = owner.getByRole('dialog');
  await dialog.getByLabel(/^Email/).fill(OLD_EMAIL);
  await dialog.getByRole('radio', { name: 'Receptionist' }).check();
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
  await expect(owner.getByRole('row', { name: new RegExp(OLD_EMAIL) })).toBeVisible();

  // ...who accepts from the emailed link and creates an account...
  const invited = await newPage(browser, baseURL);
  await invited.goto(await findEmailLink({ to: OLD_EMAIL, path: '/accept-invitation' }));
  await invited.getByRole('button', { name: 'Accept invitation' }).click();
  await invited.getByLabel('Your name').fill(FIRST_NAME);
  await invited.getByLabel('New password').fill(PASSWORD);
  await invited.getByRole('button', { name: 'Create account and accept' }).click();
  await expect(invited.getByText('You have joined the clinic. Sign in to open it.')).toBeVisible();

  // ...and signs in. This is the page the tests share.
  person = await newPage(browser, baseURL);
  await signIn(person, OLD_EMAIL);
  await expect(person.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
});

test.afterEach(async () => {
  await expectNoCspViolations(person);
});

test.afterAll(async () => {
  for (const context of contexts) await context.close();
});

test('renames the person: the user menu shows the new name at once, and a reload keeps it', async () => {
  await person.goto('/account');
  const section = person.getByRole('region', { name: 'Your name' });
  await expect(section.getByLabel('Name')).toHaveValue(FIRST_NAME);
  await expectNoAxeViolations(person);

  await section.getByLabel('Name').fill('');
  await section.getByRole('button', { name: 'Save name' }).click();
  await expect(person.getByText('Enter your name.').first()).toBeVisible();

  await section.getByLabel('Name').fill(`  ${NEW_NAME} `);
  await section.getByRole('button', { name: 'Save name' }).click();
  await expect(person.getByText('Your name was saved.')).toBeVisible();
  await expect(person.getByRole('button', { name: NEW_NAME })).toBeVisible();

  await person.reload();
  await expect(person.getByRole('button', { name: NEW_NAME })).toBeVisible();
  await expect(person.getByRole('region', { name: 'Your name' }).getByLabel('Name')).toHaveValue(
    NEW_NAME,
  );
});

test('changing the email needs the right password, and says the same thing for every address', async () => {
  await person.goto('/account');
  const section = person.getByRole('region', { name: 'Change email' });
  await expectNoAxeViolations(person);

  await section.getByLabel('New email').fill(NEW_EMAIL);
  await section.getByLabel('Your password').fill('not-the-right-password-1');
  await section.getByRole('button', { name: 'Send confirmation link' }).click();
  await expect(person.getByText('The password is incorrect.').first()).toBeVisible();
  await expect(section.getByLabel('New email')).toHaveValue(NEW_EMAIL);
  await expect(section.getByLabel('Your password')).toHaveValue('');

  await section.getByLabel('Your password').fill(PASSWORD);
  await section.getByRole('button', { name: 'Send confirmation link' }).click();
  await expect(
    person.getByText(`If ${NEW_EMAIL} can be used, we sent a link to it.`, { exact: false }),
  ).toBeVisible();
  await expect(
    person.getByText('Your email does not change until you do.', { exact: false }),
  ).toBeVisible();
  await expectNoAxeViolations(person);
  // Nothing has changed yet.
  await expect(person.getByRole('region', { name: 'Your details' })).toContainText(OLD_EMAIL);
});

test('the link from the new address confirms it: everything is signed out, only the new address signs in', async () => {
  verifyLink = await findEmailLink({ to: NEW_EMAIL, path: '/verify-email' });
  await person.goto(verifyLink);
  // The token is out of the address bar at once.
  await expect(
    person.getByRole('heading', { level: 1, name: 'Confirm your new email address' }),
  ).toBeVisible();
  expect(person.url()).not.toContain('token=');
  await expectNoAxeViolations(person);

  await person.getByRole('button', { name: 'Confirm new email address' }).click();
  await expect(
    person.getByText('Your email was changed. Sign in with your new address.'),
  ).toBeVisible();
  await expect(person).toHaveURL(/\/login/);
  expect(person.url()).not.toContain('token=');
  await expectNoAxeViolations(person);

  // The old address is refused; the new one signs in, with the new name.
  await signIn(person, OLD_EMAIL);
  await expect(person.getByRole('alert')).toBeVisible();
  await signIn(person, NEW_EMAIL);
  await expect(person.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
  await person.goto('/account');
  await expect(person.getByRole('region', { name: 'Your details' })).toContainText(NEW_EMAIL);
  await expect(person.getByRole('button', { name: NEW_NAME })).toBeVisible();
});

test('the same link used again says it is no longer valid, and points back to the account', async () => {
  await person.goto(verifyLink);
  await person.getByRole('button', { name: 'Confirm new email address' }).click();
  await expect(
    person.getByText('This link has expired, was already used, or a newer link was sent.'),
  ).toBeVisible();
  await expect(person.getByRole('link', { name: 'Go to My account' })).toBeVisible();
  await expectNoAxeViolations(person);
});
