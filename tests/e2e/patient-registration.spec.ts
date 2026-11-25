import type { Browser, BrowserContext, Page } from '@playwright/test';

import { accounts } from './fixtures/accounts.ts';
import {
  expect,
  expectNoAxeViolations,
  expectNoCspViolations,
  test,
  watchCsp,
} from './fixtures/test.ts';

// Registering, editing, archiving and restoring a patient against the real API
// (plans/06-patients.md, sub-phases 6.3 to 6.5).
//
// These specs CREATE patients in Sunrise Clinic. A patient cannot be deleted, so each one is archived
// at the end (through the API, with the page's own token, whatever state a failed test left it in).
// Every run therefore leaves archived "E2eregister..." patients behind. Each account signs in once
// per run (the API allows 5 sign-ins per 15 minutes per account).
test.describe.configure({ mode: 'serial' });

const API_ORIGIN = process.env.VITE_API_ORIGIN ?? 'http://localhost:3000';
const STAMP = Date.now();
const LAST_NAME = `E2eregister${STAMP}`;
const SWITCH_NAME = `E2eswitch${STAMP}`;
const SEEDED_PAIR_PHONE = '0918 111 2222';

async function newPage(
  browser: Browser,
  baseURL: string | undefined,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(baseURL ? { baseURL } : {});
  const page = await context.newPage();
  await watchCsp(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  return { context, page };
}

async function signIn(page: Page, account: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

const field = (page: Page, label: RegExp) => page.getByLabel(label);
const register = (page: Page) => page.getByRole('button', { name: 'Register patient' });

test.describe('the front desk registers a patient', () => {
  let context: BrowserContext | undefined;
  let page: Page;
  let authorization = '';
  const created: { id: string; version: number }[] = [];

  test.beforeAll(async ({ browser, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'creates data: one browser is enough');
    ({ context, page } = await newPage(browser, baseURL));
    page.on('request', (request) => {
      authorization = request.headers().authorization ?? authorization;
    });
    page.on('response', (response) => {
      if (response.request().method() === 'POST' && response.url().endsWith('/api/v1/patients')) {
        void response.json().then((body: { data?: { id: string; version: number } }) => {
          if (body.data && !created.some((one) => one.id === body.data?.id)) {
            created.push(body.data);
          }
        });
      }
    });
    await signIn(page, accounts.receptionist);
    await expect(page.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
  });
  test.afterEach(async () => {
    await expectNoCspViolations(page);
  });
  test.afterAll(async () => {
    for (const patient of created) {
      // Edits raise the version, so it is read again before archiving.
      const latest = (await (
        await page.request.get(`${API_ORIGIN}/api/v1/patients/${patient.id}`, {
          headers: { authorization },
        })
      ).json()) as { data: { version: number; archivedAt: string | null } };
      if (latest.data.archivedAt !== null) continue;
      const archived = await page.request.post(
        `${API_ORIGIN}/api/v1/patients/${patient.id}/archive`,
        {
          headers: { authorization },
          data: { version: latest.data.version, reason: 'E2E cleanup' },
        },
      );
      expect(archived.ok(), 'cleanup archives the e2e patient').toBe(true);
    }
    await context?.close();
  });

  test('opens the form from the list and refuses what cannot be registered', async () => {
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Patients' })
      .click();
    await page.getByRole('link', { name: 'Register a patient' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Register a patient' })).toBeVisible();
    await expect(page).toHaveTitle('Register a patient');
    await expectNoAxeViolations(page);

    await register(page).click();
    await expect(page.getByText('Enter the first name.').first()).toBeVisible();
    await expect(page.getByText('Enter the last name.').first()).toBeVisible();

    await field(page, /^First name/).fill('Elena');
    await field(page, /^Last name/).fill(LAST_NAME);
    await page.getByLabel('Month').selectOption('January');
    await page.getByLabel('Day').fill('5');
    await page.getByLabel('Year').fill('1899');
    await register(page).click();
    await expect(
      page.getByText('Enter a birth date between Jan 1, 1900 and today.').first(),
    ).toBeVisible();
    await page.getByLabel('Year').fill('1990');

    // A landline written without "+": only the API knows it cannot read it.
    await field(page, /^Phone/).fill('02 8123 4567');
    await register(page).click();
    await expect(
      page.getByText('Enter a mobile number, or start a landline or foreign number with +').first(),
    ).toBeVisible();
    await expect(field(page, /^Last name/)).toHaveValue(LAST_NAME);
    await expectNoAxeViolations(page);
    expect(created).toEqual([]);
  });

  test('shows who may be the same person, and asks before leaving to look', async () => {
    await field(page, /^Phone/).fill(SEEDED_PAIR_PHONE);
    const panel = page.getByRole('region', { name: 'Is this the same person?' });
    await expect(panel.getByRole('listitem').first()).toContainText('Same phone number');
    await expect(panel).toContainText('Maria');
    await expectNoAxeViolations(page);

    await panel
      .getByRole('link', { name: /^Open record of Maria/ })
      .first()
      .click();
    const leave = page.getByRole('alertdialog');
    await expect(leave).toContainText('Leave without saving?');
    await leave.getByRole('button', { name: 'Stay' }).click();
    await expect(field(page, /^Last name/)).toHaveValue(LAST_NAME);
  });

  test('fits a phone screen, with the matches above the button', async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    // The layout changes a moment after the window does; what was typed stays.
    await expect(field(page, /^Last name/)).toHaveValue(LAST_NAME);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(0);
    const panel = await page
      .getByRole('region', { name: 'Is this the same person?' })
      .boundingBox();
    const button = await register(page).boundingBox();
    expect(panel?.y).toBeDefined();
    expect(panel?.y ?? 0).toBeLessThan(button?.y ?? 0);
    await expectNoAxeViolations(page);
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('two quick presses register one patient, whose page opens', async () => {
    // The matches never block registering.
    await register(page).dblclick();
    await expect(page.getByRole('heading', { level: 1, name: `Elena ${LAST_NAME}` })).toBeVisible();
    await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
    await expect(page.getByText(/is registered as P-\d{6}\./).first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Contact' })).toContainText('+63 918 111 2222');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    await page.goto('/patients');
    await page
      .getByRole('searchbox', { name: 'Search by name, patient number or phone' })
      .fill(LAST_NAME);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('link', { name: `${LAST_NAME}, Elena` })).toHaveCount(1);
  });

  test('edits the patient: only the change is saved, and a reload keeps it', async () => {
    await page.getByRole('link', { name: `${LAST_NAME}, Elena` }).click();
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit patient' })).toBeVisible();
    await expect(page).toHaveTitle('Edit patient');
    await expect(field(page, /^Last name/)).toHaveValue(LAST_NAME);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Nothing to change.')).toBeVisible();

    await field(page, /^Phone/).fill('0919 333 4444');
    // (That only the changed fields are sent is checked in EditPatientPage.spec.tsx.)
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('region', { name: 'Contact' })).toContainText('+63 919 333 4444');
    await expect(page.getByText('Changes saved.').first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole('region', { name: 'Contact' })).toContainText('+63 919 333 4444');
  });

  test('two tabs edit the same patient: the second sees what changed, and loses nothing', async () => {
    const record = new URL(page.url()).pathname;
    await page.goto(`${record}/edit`);
    await expect(field(page, /^Last name/)).toHaveValue(LAST_NAME);
    const other = await page.context().newPage();
    await watchCsp(other);
    await other.goto(`${record}/edit`);
    await field(other, /^City/).fill('Makati');
    await field(other, /^Phone/).fill('0919 555 6666');
    await other.getByRole('button', { name: 'Save changes' }).click();
    await expect(other.getByRole('region', { name: 'Contact' })).toContainText('Makati');

    await field(page, /^Phone/).fill('0919 777 8888');
    await field(page, /^Email/).fill('elena@example.test');
    await page.getByRole('button', { name: 'Save changes' }).click();
    const notice = page.getByRole('alert', {
      name: 'Someone else saved changes to this patient while you were editing',
    });
    await expect(notice).toBeFocused();
    await expect(notice).toContainText('City: Not recorded → Makati');
    await expect(notice).toContainText('+63 919 555 6666');
    await expect(notice).toContainText('You also changed this');
    // Their city arrives in the form; this person's phone and email stay.
    await expect(field(page, /^City/)).toHaveValue('Makati');
    await expect(field(page, /^Phone/)).toHaveValue('0919 777 8888');
    await expect(field(page, /^Email/)).toHaveValue('elena@example.test');
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Save changes' }).click();
    const contact = page.getByRole('region', { name: 'Contact' });
    await expect(contact).toContainText('+63 919 777 8888');
    await expect(contact).toContainText('elena@example.test');
    await expect(contact).toContainText('Makati');
    await expectNoCspViolations(other);
    await other.close();
  });

  test('the edit form fits a phone screen and asks before changes are lost', async () => {
    await page.getByRole('link', { name: 'Edit', exact: true }).click();
    await page.setViewportSize({ width: 360, height: 800 });
    await field(page, /^City/).fill('Pasig');
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    await page.getByRole('link', { name: 'Cancel' }).click();
    const leave = page.getByRole('alertdialog');
    await expect(leave).toContainText('Leave without saving?');
    await leave.getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByRole('region', { name: 'Contact' })).toContainText('Makati');
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  const searchList = async (target: Page) => {
    await target.getByRole('link', { name: 'All patients' }).click();
    await target
      .getByRole('searchbox', { name: 'Search by name, patient number or phone' })
      .fill(LAST_NAME);
    await target.keyboard.press('Enter');
  };

  test('archives with a reason: gone from search until "Show archived", then restored', async () => {
    const row = page.getByRole('link', { name: `${LAST_NAME}, Elena` });
    await page.getByRole('button', { name: 'Archive' }).click();
    const dialog = page.getByRole('dialog', { name: `Archive Elena ${LAST_NAME}?` });
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Archive patient' }).click();
    await expect(dialog.getByText('Say why this patient is archived.').first()).toBeVisible();
    await expectNoAxeViolations(page);
    await dialog.getByLabel('Reason').fill('E2E duplicate record');
    await dialog.getByRole('button', { name: 'Archive patient' }).click();
    await expect(page.getByText(/Archived on .+: E2E duplicate record/)).toBeVisible();
    await expect(page.getByText(`Elena ${LAST_NAME} is archived.`).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archive', exact: true })).toHaveCount(0);
    await expectNoAxeViolations(page);

    await searchList(page);
    await expect(page.getByText('No patient matches your search').or(row)).toBeVisible();
    await expect(row).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Show archived' }).check();
    await row.click();

    await page.getByRole('button', { name: 'Restore' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText(`Restore Elena ${LAST_NAME}?`);
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expectNoAxeViolations(page);
    await confirm.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText(/Archived on/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible();

    await searchList(page);
    await expect(row).toBeVisible();
    await row.click();
  });

  test('someone else archived it first: the page says so and shows what is true', async () => {
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible();
    const other = await page.context().newPage();
    await watchCsp(other);
    await other.goto(new URL(page.url()).pathname);
    await other.getByRole('button', { name: 'Archive' }).click();
    await other.getByLabel('Reason').fill('Archived in the other tab');
    await other.getByRole('button', { name: 'Archive patient' }).click();
    await expect(other.getByText(/Archived on .+: Archived in the other tab/)).toBeVisible();

    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByRole('button', { name: 'Archive' }).click();
    await page.getByLabel('Reason').fill('Archived here too');
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Archive patient' }).click();
    // The API refuses to archive an archived patient (it says so before looking at the version).
    await expect(
      page.getByText('This patient was already archived or restored by someone else.'),
    ).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(/Archived on .+: Archived in the other tab/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    // An edit in the other tab makes this page's version old: a different answer, and words.
    await page.getByRole('button', { name: 'Restore' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible();
    await other.goto(`${new URL(page.url()).pathname}/edit`);
    await field(other, /^City/).fill('Taguig');
    await other.getByRole('button', { name: 'Save changes' }).click();
    await expect(other.getByRole('region', { name: 'Contact' })).toContainText('Taguig');
    await page.getByRole('button', { name: 'Archive' }).click();
    await page.getByLabel('Reason').fill('Archived from an old page');
    await page.getByRole('button', { name: 'Archive patient' }).click();
    await expect(
      page.getByText('Someone else changed this patient. Check the record, then try again.'),
    ).toBeVisible();
    // Read again: their change is on screen, and nothing was archived.
    await expect(page.getByRole('region', { name: 'Contact' })).toContainText('Taguig');
    await expect(page.getByText(/Archived on/)).toHaveCount(0);
    await expectNoCspViolations(other);
    await other.close();
  });
});

test.describe('the clinic is switched in another tab while a form is open', () => {
  test('nothing is saved in either clinic, and the form says why', async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'one browser is enough');
    const { context, page: form } = await newPage(browser, baseURL);
    await signIn(form, accounts.multiClinic);
    await form.getByRole('button', { name: /Sunrise Clinic/ }).click();
    await expect(form.getByRole('heading', { level: 1, name: /Welcome/ })).toBeVisible();
    await form.goto('/patients/new');
    await field(form, /^First name/).fill('Sam');
    await field(form, /^Last name/).fill(SWITCH_NAME);

    // The second tab of the same browser switches to the other clinic.
    const other = await context.newPage();
    await watchCsp(other);
    await other.goto('/');
    await other.getByRole('button', { name: /Switch clinic/ }).click();
    await other.getByRole('menuitemradio', { name: 'Lakeside Family Clinic' }).click();
    await expect(other.getByRole('button', { name: /Lakeside Family Clinic/ })).toBeVisible();
    // The first tab hears about it and keeps what was typed.
    await expect(form.getByRole('button', { name: /Lakeside Family Clinic/ })).toBeVisible();
    await expect(field(form, /^Last name/)).toHaveValue(SWITCH_NAME);

    await register(form).click();
    await expect(
      form.getByText(
        'This page was opened for Sunrise Clinic. You are now working in Lakeside Family Clinic. Nothing was saved.',
      ),
    ).toBeVisible();
    await expect(field(form, /^Last name/)).toHaveValue(SWITCH_NAME);
    await expectNoAxeViolations(form);

    // The search tolerates typos, so similar names may come back: what matters is that no patient
    // with exactly this last name exists in either clinic, archived ones included.
    const searchFor = async () => {
      await other.goto('/patients?includeArchived=true');
      const answer = other.waitForResponse(
        (response) => new URL(response.url()).searchParams.get('q') === SWITCH_NAME,
      );
      await other
        .getByRole('searchbox', { name: 'Search by name, patient number or phone' })
        .fill(SWITCH_NAME);
      await other.keyboard.press('Enter');
      const body = (await (await answer).json()) as { data: { lastName: string }[] };
      expect(body.data.filter((patient) => patient.lastName === SWITCH_NAME)).toEqual([]);
    };
    await searchFor(); // Lakeside
    await other.getByRole('button', { name: /Switch clinic/ }).click();
    await other.getByRole('menuitemradio', { name: 'Sunrise Clinic' }).click();
    await expect(other.getByRole('button', { name: /Sunrise Clinic/ })).toBeVisible();
    await searchFor(); // Sunrise
    await expectNoCspViolations(form);
    await context.close();
  });
});
