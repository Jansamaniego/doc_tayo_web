import { expect, expectNoAxeViolations, test } from './fixtures/test.ts';
import type { Page } from '@playwright/test';

// The design system in a real browser, served the way production serves it (with the production
// Content-Security-Policy in report-only mode: any violation fails the test, see fixtures/test.ts).
const GALLERY = '/components-gallery';

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${GALLERY}?${query}`);
  await expect(page.getByTestId('gallery')).toBeVisible();
}

const SECTIONS = ['components', 'patterns', 'tokens'] as const;

test.describe('components gallery', () => {
  for (const section of SECTIONS) {
    test(`${section}: no accessibility violations and no CSP violations`, async ({ page }) => {
      await open(page, `section=${section}`);
      await expectNoAxeViolations(page);
    });
  }

  test('every interactive element is at least 44 x 44 px (a checkbox, radio or switch counts as its whole row)', async ({
    page,
  }) => {
    await open(page, 'section=all');
    const small = await page.evaluate(() => {
      const selector =
        'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=tab], [role=combobox], [role=checkbox], [role=radio], [role=switch], [role=option]';
      const found: string[] = [];
      for (const element of document.querySelectorAll<HTMLElement>(selector)) {
        if (
          element.closest('[aria-hidden="true"]') ||
          (element.tabIndex === -1 && element.getAttribute('role') !== 'option')
        )
          continue;
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        // A link inside a sentence is exempt (WCAG 2.5.8 inline exception).
        if (
          element.tagName === 'A' &&
          element.parentElement?.tagName === 'P' &&
          element.parentElement.childNodes.length > 1
        )
          continue;
        const target = element.matches('[role=checkbox], [role=radio]')
          ? (element.closest('label') ?? element)
          : element;
        const box = target.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        if (box.width < 43.5 || box.height < 43.5) {
          found.push(
            `${element.tagName.toLowerCase()}${element.getAttribute('role') ? `[${element.getAttribute('role')}]` : ''} "${(element.textContent.trim() ? element.textContent : (element.getAttribute('aria-label') ?? '')).trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`,
          );
        }
      }
      return found;
    });
    expect(small, 'targets smaller than 44 x 44 px').toEqual([]);
  });

  for (const stretch of ['', '&stretch=1']) {
    for (const width of [1280, 640, 320]) {
      test(`reflows with no sideways scrolling at ${width} px${stretch ? ' with text stretched 40%' : ''} (${width === 640 ? '200%' : width === 320 ? '400%' : '100%'} zoom)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: width, height: 900 });
        await open(page, `section=all${stretch}`);
        const overflowing = await page.evaluate(() => {
          const width = document.documentElement.clientWidth;
          const wide: string[] = [];
          for (const section of document.querySelectorAll<HTMLElement>('[data-story]')) {
            // A table may scroll inside its own box; nothing may push the page itself sideways.
            if (section.scrollWidth > width + 1 && !section.querySelector('.overflow-x-auto'))
              wide.push(`${section.dataset.story ?? ''} ${section.scrollWidth}>${width}`);
          }
          const offenders: string[] = [];
          for (const element of document.querySelectorAll<HTMLElement>('body *')) {
            const right = element.getBoundingClientRect().right;
            if (right > width + 1 && !element.parentElement?.closest('.overflow-x-auto')) {
              offenders.push(
                `${element.tagName.toLowerCase()}.${element.className.slice(0, 40)} right=${Math.round(right)} text="${element.textContent.slice(0, 20)}"`,
              );
            }
          }
          return {
            page: document.documentElement.scrollWidth > width + 1,
            wide,
            offenders: offenders.slice(0, 6),
          };
        });
        expect(overflowing.offenders, 'elements past the right edge').toEqual([]);
        expect(overflowing.page, 'the page scrolls sideways').toBe(false);
        expect(overflowing.wide, 'stories wider than the screen').toEqual([]);
      });
    }
  }

  test('text spacing can be widened without losing content (WCAG 1.4.12)', async ({ page }) => {
    await open(page, 'section=components');
    // A constructable stylesheet: the CSP forbids an injected <style> element, and this test must not break the policy.
    await page.evaluate(() => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(
        '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
      );
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    });
    const clipped = await page.evaluate(() => {
      const found: string[] = [];
      for (const element of document.querySelectorAll<HTMLElement>('button, label, h2, h3, p')) {
        const style = getComputedStyle(element);
        if (
          ['hidden', 'clip'].includes(style.overflow) &&
          (element.scrollWidth > element.clientWidth + 1 ||
            element.scrollHeight > element.clientHeight + 1)
        )
          found.push(element.textContent.slice(0, 30));
      }
      return found;
    });
    expect(clipped).toEqual([]);
  });
});

test.describe('app shell', () => {
  const VIEWPORTS = [
    { name: 'DesktopOwner', width: 1280, height: 800 },
    { name: 'DesktopReceptionist', width: 1280, height: 800 },
    { name: 'TabletOwner', width: 768, height: 1024 },
    { name: 'MobileOwner', width: 360, height: 800 },
    { name: 'MobileReceptionist', width: 360, height: 800 },
  ];
  for (const { name, width, height } of VIEWPORTS) {
    test(`${name}: no violations, navigation reachable, no sideways scrolling at ${width} x ${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await open(page, `story=${encodeURIComponent(`Patterns/App shell/${name}`)}&bare=1`);
      await expectNoAxeViolations(page);
      await expect(
        page
          .getByRole('navigation', { name: 'Main' })
          .or(page.getByRole('button', { name: 'Menu' }))
          .first(),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        ),
      ).toBe(false);
    });
  }

  test('a receptionist does not see Staff or Clinic settings, an owner does', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(
      page,
      `story=${encodeURIComponent('Patterns/App shell/DesktopReceptionist')}&bare=1`,
    );
    await expect(page.getByRole('link', { name: 'Branches' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Staff' })).toHaveCount(0);
    await open(page, `story=${encodeURIComponent('Patterns/App shell/DesktopOwner')}&bare=1`);
    await expect(page.getByRole('link', { name: 'Staff' })).toBeVisible();
  });
});

test.describe('TV display', () => {
  const STORIES = [
    'Normal',
    'NumberOnly',
    'ManyQueues',
    'EmptyQueue',
    'NewCallHighlight',
    'Reconnecting',
    'OfflineOverTwoMinutes',
    'DarkTheme',
    'Pairing',
  ];
  const SIZES = [
    { label: '1920x1080 (design target)', width: 1920, height: 1080 },
    { label: '3840x2160', width: 3840, height: 2160 },
    { label: '1280x720 (small edge)', width: 1280, height: 720 },
  ];
  for (const { label, width, height } of SIZES) {
    test(`fits the screen with nothing cut off at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      for (const story of STORIES) {
        await open(page, `story=${encodeURIComponent(`TV display/${story}`)}&bare=1`);
        const tv = page.getByTestId('gallery').locator('> div').first();
        const overflow = await tv.evaluate((element) => ({
          x: element.scrollWidth - element.clientWidth,
          y: element.scrollHeight - element.clientHeight,
        }));
        expect(overflow.x, `${story} sideways overflow`).toBeLessThanOrEqual(1);
        expect(overflow.y, `${story} vertical overflow`).toBeLessThanOrEqual(1);
      }
    });
  }

  test('the number is readable from across the room: at 1080p the "Now serving" number is about 280 px high', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await open(page, `story=${encodeURIComponent('TV display/Normal')}&bare=1`);
    const size = await page
      .getByText('A-024')
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(size).toBeGreaterThanOrEqual(250);
    expect(size).toBeLessThanOrEqual(300);
  });

  test('has nothing to touch and no accessibility violations', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await open(page, `story=${encodeURIComponent('TV display/Normal')}&bare=1`);
    expect(await page.getByTestId('gallery').locator('button, a, input').count()).toBe(0);
    await expectNoAxeViolations(page);
  });
});

test('screenshots for the style guide review', async ({ page, browserName }, testInfo) => {
  test.skip(
    browserName !== 'chromium' || testInfo.project.name !== 'chromium',
    'one browser is enough for the reference images',
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const section of ['components', 'patterns', 'tokens']) {
    await open(page, `section=${section}`);
    await page.screenshot({ path: testInfo.outputPath(`gallery-${section}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const story of [
    'Normal',
    'ManyQueues',
    'DarkTheme',
    'Pairing',
    'NewCallHighlight',
    'Reconnecting',
    'OfflineOverTwoMinutes',
    'EmptyQueue',
  ]) {
    await open(page, `story=${encodeURIComponent(`TV display/${story}`)}&bare=1`);
    await page.screenshot({ path: testInfo.outputPath(`tv-${story}.png`) });
  }
});
