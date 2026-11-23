import type { Browser, BrowserContext, Page } from '@playwright/test';

import { accounts } from './fixtures/accounts.ts';
import {
  expect,
  expectNoAxeViolations,
  expectNoCspViolations,
  test,
  watchCsp,
} from './fixtures/test.ts';

// The Staff screens against the real API (plans/05-staff-and-account.md, sub-phases 5.1, 5.2 and 5.3).
// The changes made to the seeded doctor (job title, roles, suspend) are all put back before each test
// ends, so the seeded accounts stay as the seed made them. Each account signs in once per run (the
// API allows 5 per 15 minutes per account), so each describe shares one signed-in page. The
// invitations created here are revoked again, but an invitation cannot be deleted, so each run leaves
// one revoked "e2e-...@example.test" invitation behind. The acceptance and cross-clinic checks are
// added with M7.
const DOCTOR = 'Dr. Dan Doctor';
const OWNER_NAME = 'Dr. Olivia Owner';
const ADMIN_NAME = 'Ada Admin';
test.describe.configure({ mode: 'serial' });

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

async function openPerson(page: Page, name: string): Promise<void> {
  await page.goto('/staff');
  await page.getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test.describe('an owner', () => {
  let context: BrowserContext | undefined;
  let page: Page;

  test.beforeAll(async ({ browser, baseURL }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'one browser is enough for this read-only pass',
    );
    ({ context, page } = await signedInPage(browser, baseURL, accounts.owner));
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

  test('opens Staff from the navigation and sees the clinic’s people', async () => {
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Staff' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Staff' })).toBeVisible();
    await expect(page).toHaveURL(/\/staff$/);

    const table = page.getByRole('table', { name: 'Staff' });
    const own = table.getByRole('row', { name: new RegExp(accounts.owner.email) });
    await expect(own).toContainText('(you)');
    await expect(own).toContainText('Owner');
    await expect(own).toContainText('Active');
    const other = table.getByRole('row', { name: new RegExp(accounts.receptionist.email) });
    await expect(other).toContainText('Receptionist');
    await expect(other).not.toContainText('(you)');
    await expect(page.getByText(/Dates are shown in Asia\/Manila/)).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('filters by status and searches without putting the text in the address', async () => {
    await page.goto('/staff');
    await page.getByLabel('Status').selectOption('Suspended');
    await expect(page).toHaveURL(/status=suspended/);
    await page.getByLabel('Status').selectOption('All');
    await expect(page).not.toHaveURL(/status=/);

    await page.getByRole('searchbox', { name: 'Search staff' }).fill('reception');
    await page.keyboard.press('Enter');
    const table = page.getByRole('table', { name: 'Staff' });
    await expect(
      table.getByRole('row', { name: new RegExp(accounts.receptionist.email) }),
    ).toBeVisible();
    await expect(table.getByRole('row', { name: new RegExp(accounts.owner.email) })).toHaveCount(0);
    expect(page.url().includes('reception')).toBe(false);

    await page.getByRole('searchbox', { name: 'Search staff' }).fill('nobody-called-this-zzz');
    await page.keyboard.press('Enter');
    await expect(page.getByText('No staff match your search')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('opens a person and shows their details', async () => {
    await page.goto('/staff');
    // By the row's email, not the name: another account may share the name.
    await page
      .getByRole('row', { name: new RegExp(accounts.receptionist.email.replace('.', '\\.')) })
      .getByRole('link')
      .click();
    await expect(page).toHaveURL(/\/staff\/[0-9a-f-]{36}$/);
    await expect(page.getByText(accounts.receptionist.email)).toBeVisible();
    await expect(page.getByText('Receptionist').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'All staff' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('explains what each role can do', async () => {
    await page.goto('/staff');
    await page.getByRole('button', { name: 'What each role can do' }).click();
    await expect(page.getByRole('region', { name: 'Owner' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Receptionist' })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('a person who is not on this clinic’s staff sends the owner back to the list', async () => {
    await page.goto('/staff/00000000-0000-4000-8000-000000000000');
    await expect(page.getByText('This person is not on your staff.')).toBeVisible();
    await expect(page).toHaveURL(/\/staff\?notice=missing$/);
  });

  test('edits a job title and puts it back', async () => {
    await openPerson(page, DOCTOR);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel(/^Job title/).fill('  E2E title ');
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('E2E title')).toBeVisible();
    await expect(page.getByLabel(/^Job title/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel(/^Job title/).fill('');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('E2E title')).toHaveCount(0);
  });

  test('changes roles, refuses none, and puts them back', async () => {
    await openPerson(page, DOCTOR);
    const roles = page.getByRole('group', { name: 'Roles' });
    const rolesRow = page.locator('dd').filter({ hasText: /Doctor|Nurse/ });
    try {
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await roles.getByRole('checkbox', { name: 'Doctor' }).uncheck();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Choose at least one role.').first()).toBeVisible();

      await roles.getByRole('checkbox', { name: 'Nurse' }).check();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(rolesRow).toHaveText('Nurse');
    } finally {
      // Whatever happened above, the doctor ends as the seed made them.
      await openPerson(page, DOCTOR);
      if ((await rolesRow.textContent()) !== 'Doctor') {
        await page.getByRole('button', { name: 'Edit', exact: true }).click();
        await roles.getByRole('checkbox', { name: 'Doctor' }).check();
        await roles.getByRole('checkbox', { name: 'Nurse' }).uncheck();
        await page.getByRole('button', { name: 'Save' }).click();
      }
    }
    await expect(rolesRow).toHaveText('Doctor');
  });

  test('suspends the doctor and reactivates them, each after a confirmation', async () => {
    await openPerson(page, DOCTOR);
    await page.getByRole('button', { name: 'Suspend' }).click();
    const suspend = page.getByRole('alertdialog');
    await expect(suspend).toContainText(`Suspend ${DOCTOR}?`);
    await expect(suspend.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expectNoAxeViolations(page);
    await suspend.getByRole('button', { name: 'Suspend' }).click();
    await expect(page.getByText('Suspended', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Reactivate' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reactivate' }).click();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Suspend' })).toBeVisible();
  });

  test('Remove asks first and Cancel changes nothing', async () => {
    await openPerson(page, DOCTOR);
    await page.getByRole('button', { name: 'Remove' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('You cannot undo this here');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
  });

  test('on their own row, the owner can only edit their job title', async () => {
    await openPerson(page, OWNER_NAME);
    await expect(page.getByRole('button', { name: 'Edit job title' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Suspend' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0);
    await expect(page.getByText('Another admin must change your roles or status.')).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('invites someone, refuses a duplicate and a current member, sends again and revokes', async () => {
    const email = `e2e-${Date.now()}@example.test`;
    await page.goto('/staff');
    await page
      .getByRole('navigation', { name: 'Staff sections' })
      .getByRole('link', { name: 'Invitations' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Invitations' })).toBeVisible();
    await expect(page).toHaveURL(/\/staff\/invitations$/);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Invite someone' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('radio', { name: 'Owner' })).toHaveCount(0);
    await expect(dialog.getByRole('radio', { name: 'Receptionist' })).toBeVisible();
    await expectNoAxeViolations(page);
    await dialog.getByRole('button', { name: 'Send invitation' }).click();
    await expect(dialog.getByText('Choose a role.').first()).toBeVisible();

    // An existing member is refused.
    await dialog.getByLabel(/^Email/).fill(accounts.receptionist.email);
    await dialog.getByRole('radio', { name: 'Receptionist' }).check();
    await dialog.getByRole('button', { name: 'Send invitation' }).click();
    await expect(dialog.getByText('This person is already on your staff.').first()).toBeVisible();

    // A new address is invited.
    await dialog.getByLabel(/^Email/).fill(email);
    await dialog.getByRole('button', { name: 'Send invitation' }).click();
    await expect(dialog).toHaveCount(0);
    const row = page.getByRole('row', { name: new RegExp(email) });
    await expect(row).toContainText('Receptionist');
    await expect(row).toContainText('Pending');
    await expect(row).toContainText(OWNER_NAME);

    // The same address again is refused, and the dialog offers the open ones.
    await page.getByRole('button', { name: 'Invite someone' }).click();
    await page
      .getByRole('dialog')
      .getByLabel(/^Email/)
      .fill(email);
    await page.getByRole('dialog').getByRole('radio', { name: 'Receptionist' }).check();
    await page.getByRole('dialog').getByRole('button', { name: 'Send invitation' }).click();
    await expect(
      page.getByRole('dialog').getByText('An invitation to this address is already open.').first(),
    ).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Show open invitations' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Send again, then revoke after a confirmation.
    await page.getByRole('button', { name: `Resend invitation to ${email}` }).click();
    await expect(
      page.getByText('A new link was sent. The old link no longer works.'),
    ).toBeVisible();
    await page.getByRole('button', { name: `Revoke invitation to ${email}` }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText(`Revoke the invitation to ${email}?`);
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expectNoAxeViolations(page);
    await confirm.getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByRole('row', { name: new RegExp(email) })).toHaveCount(0);

    // It is under Revoked now, with no buttons.
    await page.getByLabel('Status').selectOption('Revoked');
    await expect(page).toHaveURL(/status=revoked/);
    const revoked = page.getByRole('row', { name: new RegExp(email) });
    await expect(revoked).toContainText('Revoked');
    await expect(revoked.getByRole('button')).toHaveCount(0);
    await expectNoAxeViolations(page);
  });

  test('fits a phone screen with no sideways scrolling', async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/staff');
    await expect(page.getByRole('heading', { level: 1, name: 'Staff' })).toBeVisible();
    await expect(page.getByText(accounts.owner.email).first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});

test.describe('a clinic admin', () => {
  let context: BrowserContext | undefined;
  let page: Page;

  test.beforeAll(async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'one browser is enough for this pass');
    ({ context, page } = await signedInPage(browser, baseURL, accounts.clinicAdmin));
  });
  test.afterEach(async () => {
    await expectNoCspViolations(page);
  });
  test.afterAll(async () => {
    await context?.close();
  });

  test('sees the full set on the doctor, without the Owner role to give', async () => {
    await openPerson(page, DOCTOR);
    await expect(page.getByRole('button', { name: 'Suspend' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    const roles = page.getByRole('group', { name: 'Roles' });
    await expect(roles.getByRole('checkbox', { name: 'Doctor' })).toBeChecked();
    await expect(roles.getByRole('checkbox', { name: 'Owner' })).toHaveCount(0);
    await expect(page.getByText('Only an owner can give the Owner role.')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('can only edit the job title on the owner’s row, and says why', async () => {
    await openPerson(page, OWNER_NAME);
    await expect(page.getByRole('button', { name: 'Edit job title' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Suspend' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0);
    await expect(
      page.getByText("Only an owner can change an owner's roles or status."),
    ).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('can only edit the job title on their own row', async () => {
    await openPerson(page, ADMIN_NAME);
    await expect(page.getByRole('button', { name: 'Edit job title' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Suspend' })).toHaveCount(0);
    await expect(page.getByText('Another admin must change your roles or status.')).toBeVisible();
  });
});

test.describe('a receptionist', () => {
  let context: BrowserContext | undefined;
  let page: Page;
  const staffRequests: string[] = [];

  test.beforeAll(async ({ browser, baseURL }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'one browser is enough for this read-only pass',
    );
    ({ context, page } = await signedInPage(browser, baseURL, accounts.receptionist));
    page.on('request', (request) => {
      if (/\/api\/v1\/(members|invitations)/.test(request.url())) staffRequests.push(request.url());
    });
  });
  test.afterEach(async () => {
    await expectNoCspViolations(page);
  });
  test.afterAll(async () => {
    await context?.close();
  });

  test('has no Staff item, and a typed address shows "no access" without asking for the staff', async () => {
    await expect(
      page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Staff' }),
    ).toHaveCount(0);

    await page.goto('/staff');
    await expect(
      page.getByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeVisible();
    await expectNoAxeViolations(page);
    await page.goto('/staff/invitations');
    await expect(
      page.getByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeVisible();
    expect(staffRequests).toEqual([]);
  });
});
