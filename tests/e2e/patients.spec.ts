import type { Browser, BrowserContext, Page } from '@playwright/test';

import { accounts } from './fixtures/accounts.ts';
import {
  expect,
  expectNoAxeViolations,
  expectNoCspViolations,
  test,
  watchCsp,
} from './fixtures/test.ts';

// The patient list, search and patient page against the real API (plans/06-patients.md, sub-phases
// 6.1 and 6.2). Read-only:
// it relies on the patients the backend's `npm run db:seed:dev` registers (8 in Sunrise, one of them
// archived; 2 in Lakeside). Each account signs in once per run (the API allows 5 per 15 minutes).
// Registering, editing and archiving are added with 6.3 to 6.5.
test.describe.configure({ mode: 'serial' });

const SEARCH = 'Search by name, patient number or phone';
/** The address of a Sunrise patient, remembered so the other clinic can try to open it. */
let sunrisePatientPath = '';

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

test.describe('the front desk', () => {
  let context: BrowserContext | undefined;
  let page: Page;

  const row = (name: string) => page.getByRole('row', { name: new RegExp(name) });
  const search = async (text: string) => {
    await page.getByRole('searchbox', { name: SEARCH }).fill(text);
    await page.keyboard.press('Enter');
  };

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

  test('opens Patients from the navigation: by family name, without the archived one', async () => {
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Patients' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Patients' })).toBeVisible();
    await expect(row('Dela Cruz, Juan')).toContainText('+63 917 123 4567');
    await expect(row('Dela Cruz, Juan')).toContainText('Mar 14, 1985');
    await expect(row('Dela Cruz, Juan')).toContainText('years');
    await expect(row('Villanueva, Ramon')).toHaveCount(0);

    const names = await page.getByRole('row').allInnerTexts();
    const at = (name: string) => names.findIndex((text) => text.includes(name));
    expect(at('Bautista, Pedro')).toBeGreaterThan(0);
    expect(at('Bautista, Pedro')).toBeLessThan(at('Dela Cruz, Juan'));
    await expectNoAxeViolations(page);
  });

  test('"Show archived" adds the archived patient, marked in words, and keeps that in the address', async () => {
    await page.goto('/patients');
    await page.getByRole('checkbox', { name: 'Show archived' }).check();
    await expect(page).toHaveURL(/includeArchived=true/);
    await expect(row('Villanueva, Ramon')).toContainText('Archived');
    await expect(row('Dela Cruz, Juan')).toContainText('Active');
    await expectNoAxeViolations(page);
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Show archived' })).toBeChecked();
    await expect(row('Villanueva, Ramon')).toBeVisible();
  });

  test('finds a patient from a typo, a name without accents, a patient number and a local phone', async () => {
    await page.goto('/patients');
    for (const [typed, found] of [
      ['dela crus', 'Dela Cruz, Juan'],
      ['jose pena', 'Peña, José'],
      ['p-6', 'Bautista, Pedro'],
      ['0917 123 4567', 'Dela Cruz, Juan'],
    ] as const) {
      await search(typed);
      await expect(row(found), `searching ${typed}`).toBeVisible();
      await expect(page.getByRole('row').nth(1)).toContainText(found);
      // What was typed is personal data: never in the address.
      expect(new URL(page.url()).search).toBe('');
    }
    await search('nobody-called-this-zzz');
    await expect(page.getByText('No patient matches your search')).toBeVisible();
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(row('Dela Cruz, Juan')).toBeVisible();
  });

  test('opens a patient from the list: number, allergies, contact and notes, no name in the title', async () => {
    await page.goto('/patients');
    await page.getByRole('link', { name: 'Dela Cruz, Juan' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Juan Dela Cruz' })).toBeVisible();
    await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
    sunrisePatientPath = new URL(page.url()).pathname;
    await expect(page).toHaveTitle('Patient record');
    const summary = page.getByRole('region', { name: 'Patient summary' });
    await expect(summary).toContainText(/P-\d{6}/);
    await expect(summary).toContainText('Mar 14, 1985');
    await expect(summary).toContainText('years');
    await expect(page.getByRole('region', { name: 'Contact' })).toContainText('+63 917 123 4567');
    await expect(page.getByRole('region', { name: 'Allergies' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Front desk notes (not medical)' }),
    ).toContainText('Prefers Tagalog.');
    await expect(page.getByRole('region', { name: 'Guardian' })).toHaveCount(0);
    await expectNoAxeViolations(page);

    await context?.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Copy number' }).click();
    await expect(page.getByText('Copied')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^P-\d{6}$/);

    await page.getByRole('link', { name: 'All patients' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Patients' })).toBeVisible();
  });

  test('shows a child with a guardian, and an archived patient with why', async () => {
    await page.goto('/patients');
    await page.getByRole('link', { name: 'Reyes, Angela' }).click();
    await expect(page.getByRole('region', { name: 'Guardian' })).toContainText('Carmen Reyes');
    await expectNoAxeViolations(page);

    await page.goto('/patients?includeArchived=true');
    await page.getByRole('link', { name: 'Villanueva, Ramon' }).click();
    await expect(page.getByText(/Archived on .+: Moved to another clinic/)).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test('says it could not find a patient for an unknown or broken address', async () => {
    for (const path of ['/patients/00000000-0000-4000-8000-000000000000', '/patients/not-an-id']) {
      await page.goto(path);
      await expect(
        page.getByRole('heading', { level: 1, name: 'We could not find this patient' }),
      ).toBeVisible();
    }
    await expectNoAxeViolations(page);
  });

  test('the patient page fits a phone screen', async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(sunrisePatientPath);
    await expect(page.getByRole('heading', { level: 1, name: 'Juan Dela Cruz' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });

  test('fits a phone screen with no sideways scrolling', async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/patients');
    await expect(page.getByText('Dela Cruz, Juan')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});

test.describe('another clinic', () => {
  test('sees only its own patients (cross-clinic isolation)', async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'one browser is enough for this read-only pass',
    );
    const { context, page } = await signedInPage(browser, baseURL, accounts.lakesideOwner);
    await page.goto('/patients?includeArchived=true');
    await expect(page.getByRole('row', { name: /Mendoza, Liza/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Dela Cruz/ })).toHaveCount(0);
    await page.getByRole('searchbox', { name: SEARCH }).fill('Dela Cruz');
    await page.keyboard.press('Enter');
    await expect(page.getByText('No patient matches your search')).toBeVisible();
    // A Sunrise patient's address, opened from Lakeside: the API says "not found", never whose it is.
    expect(sunrisePatientPath).not.toBe('');
    await page.goto(sunrisePatientPath);
    await expect(
      page.getByRole('heading', { level: 1, name: 'We could not find this patient' }),
    ).toBeVisible();
    await expect(page.getByText('Dela Cruz')).toHaveCount(0);
    await expectNoCspViolations(page);
    await context.close();
  });
});
