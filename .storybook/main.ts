import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import { lingui } from '@lingui/vite-plugin';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';

// The living style guide (plans/02-design-system.md §11): every token and component in every state.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)', '../src/**/*.mdx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      plugins: [tailwindcss(), lingui({ macroTransform: true })],
      resolve: {
        alias: [
          { find: '@', replacement: fileURLToPath(new URL('../src', import.meta.url)) },
          {
            find: /^react-remove-scroll$/,
            replacement: fileURLToPath(
              new URL('../src/design-system/scroll-lock.tsx', import.meta.url),
            ),
          },
        ],
      },
    }),
};

export default config;
