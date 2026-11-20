import type { Preview } from '@storybook/react-vite';
import { I18nProvider } from '@lingui/react';

import { activateLocale } from '../src/i18n/index.ts';
import { i18n } from '../src/i18n/index.ts';
import '../src/index.css';
import '../src/design-system/stress.css';

// Toolbar: language (English, or the pseudo-locale that accents every translated string so hard-coded
// text stands out) and "Stretch", which widens text about 40% to mimic longer translations (Filipino).
const preview: Preview = {
  globalTypes: {
    locale: {
      description: 'Language',
      toolbar: {
        title: 'Language',
        items: [
          { value: 'en', title: 'English' },
          { value: 'pseudo', title: 'Pseudo (accented)' },
        ],
      },
    },
    stretch: {
      description: 'Stretch text 40% (longer translations)',
      toolbar: {
        title: 'Text',
        items: [
          { value: 'off', title: 'Normal text' },
          { value: 'on', title: 'Stretched text (+40%)' },
        ],
      },
    },
  },
  initialGlobals: { locale: 'en', stretch: 'off' },
  decorators: [
    (Story, context) => {
      activateLocale(context.globals.locale === 'pseudo' ? 'pseudo' : 'en');
      return (
        <I18nProvider i18n={i18n}>
          <div
            data-stretch={context.globals.stretch === 'on' ? 'on' : undefined}
            className="bg-page p-4 text-ink"
          >
            <Story />
          </div>
        </I18nProvider>
      );
    },
  ],
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
};

export default preview;
