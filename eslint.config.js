import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const RESTRICTED_GLOBALS = [
  {
    name: 'fetch',
    message: 'Call the API only through src/api (the typed client). See AGENTS.md.',
  },
  {
    name: 'localStorage',
    message: 'No browser storage outside src/lib/preferences.ts (privacy rule, plan.md §11).',
  },
  {
    name: 'sessionStorage',
    message: 'No browser storage outside src/lib/preferences.ts (privacy rule, plan.md §11).',
  },
];

const JSX_TEXT_SELECTOR =
  "JSXElement:not([openingElement.name.name='Trans']) > JSXText[value=/[A-Za-z]{2,}/]";

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'node_modules',
      'src/api/schema.d.ts',
      'src/routeTree.gen.ts',
      'src/i18n/locales',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  jsxA11y.flatConfigs.strict,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: { allowDefaultProject: ['*.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-globals': ['error', ...RESTRICTED_GLOBALS],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is not allowed (XSS).',
        },
        {
          selector: JSX_TEXT_SELECTOR,
          message: 'No hard-coded text: use <Trans> or t`...` from Lingui (plan.md §5.6.1).',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@date-fns/tz',
              message: 'Only src/lib/datetime converts between UTC and clinic time.',
            },
            {
              name: 'zod',
              message: "Import { z } from '@/lib/zod.ts': it turns off Zod's eval-based JIT (CSP).",
            },
          ],
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  // Plain JS (this file) is not type-checked.
  { files: ['**/*.js'], ...tseslint.configs.disableTypeChecked },
  // The only places that may touch the browser's network or storage or the time-zone library.
  {
    files: ['src/api/**'],
    rules: { 'no-restricted-globals': ['error', ...RESTRICTED_GLOBALS.slice(1)] },
  },
  {
    files: ['src/lib/preferences.ts'],
    rules: { 'no-restricted-globals': ['error', RESTRICTED_GLOBALS[0]] },
  },
  { files: ['src/lib/datetime/**'], rules: { 'no-restricted-imports': 'off' } },
  { files: ['src/lib/zod.ts'], rules: { 'no-restricted-imports': 'off' } },
  // The design system is feature-agnostic: no features, no API.
  {
    files: ['src/design-system/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/api/*', '@/routes/*', '@/app/*'],
              message: 'design-system must not import from features, api, routes or app.',
            },
          ],
        },
      ],
    },
  },
  // Tests, scripts and tool config may use Node, fetch (MSW, Playwright) and literal text.
  {
    files: [
      '**/*.spec.{ts,tsx}',
      'src/test/**',
      'tests/**',
      'scripts/**',
      '*.config.ts',
      'vite.config.ts',
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-imports': 'off',
    },
  },
);
