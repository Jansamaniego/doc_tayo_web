import { defineConfig, devices } from '@playwright/test';

// Real API required (plan.md §8): start it from the backend's docker compose and run
// `npm run db:seed:dev` there. The API's CORS_ALLOWED_ORIGINS must contain this preview origin.
const PREVIEW_ORIGIN = 'http://localhost:4173';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: PREVIEW_ORIGIN, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // Android mid-range phone, about 360x800 (plan.md §11).
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: {
    command: 'npx vite build --mode e2e && npx vite preview --mode e2e',
    url: PREVIEW_ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
