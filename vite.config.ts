import { lingui } from '@lingui/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

import { buildCsp } from './src/config/csp.ts';

// Only used by the dev server: Vite injects <style> elements and a react-refresh script.
const DEV_STYLE_NONCE = 'doctayo-dev-only-nonce';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiOrigin = env.VITE_API_ORIGIN ?? 'http://localhost:3000';
  // Report-only until Phase 13 (plan.md §11). Violations fail the e2e tests (tests/e2e/fixtures).
  const productionCsp = buildCsp({ apiOrigin });

  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      lingui({ macroTransform: true }),
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    html: { cspNonce: DEV_STYLE_NONCE },
    server: {
      port: 5173,
      strictPort: true,
      headers: {
        'Content-Security-Policy-Report-Only': buildCsp({
          apiOrigin,
          dev: { styleNonce: DEV_STYLE_NONCE },
        }),
      },
    },
    preview: {
      port: 4173,
      strictPort: true,
      headers: { 'Content-Security-Policy-Report-Only': productionCsp },
    },
  };
});
