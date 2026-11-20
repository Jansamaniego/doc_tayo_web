import { defineConfig } from '@lingui/conf';
import { formatter } from '@lingui/format-po';

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'pseudo'],
  pseudoLocale: 'pseudo',
  fallbackLocales: { pseudo: 'en' },
  catalogs: [{ path: '<rootDir>/src/i18n/locales/{locale}', include: ['src'] }],
  format: formatter({ lineNumbers: false }),
});
