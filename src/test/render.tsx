import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import { i18n } from '@/i18n/index.ts';

/** Renders with the app's providers. `rerender` keeps them, so a changed prop does not lose i18n. */
export function renderWithProviders(ui: ReactElement): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrap = (node: ReactNode): ReactElement => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
    </I18nProvider>
  );
  const result = render(wrap(ui));
  return {
    ...result,
    rerender: (next) => {
      result.rerender(wrap(next));
    },
  };
}
