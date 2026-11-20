import { I18nProvider } from '@lingui/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { MisconfiguredPage } from '@/app/MisconfiguredPage.tsx';
import { parseEnv } from '@/config/env.ts';
import { i18n } from '@/i18n/index.ts';

import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element.');
const root = createRoot(container);

// Validate the configuration before anything else: a wrong setting shows a plain page, not a blank screen.
const config = parseEnv(import.meta.env);
if (config.ok) {
  const { App } = await import('@/app/App.tsx');
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  root.render(
    <I18nProvider i18n={i18n}>
      <MisconfiguredPage invalidKeys={config.invalidKeys} />
    </I18nProvider>,
  );
}
