import { lingui } from '@lingui/vite-plugin';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Date logic must never depend on the computer's time zone. Tests run in a zone that is NOT
// Asia/Manila, so code that uses local time fails. CI runs the date specs a second time with
// TEST_TZ=Asia/Manila (plan.md §5.6).
process.env.TZ = process.env.TEST_TZ ?? 'America/New_York';

export default defineConfig({
  plugins: [react(), lingui({ macroTransform: true })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.spec.{ts,tsx}', 'scripts/**/*.spec.ts'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
