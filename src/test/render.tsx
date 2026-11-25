import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import type { SessionController } from '@/api/session/session.ts';
import { SessionControllerProvider } from '@/features/auth/session-context.tsx';
import { i18n } from '@/i18n/index.ts';

/** Renders with the app's providers. `rerender` keeps them, so a changed prop does not lose i18n. */
export function renderWithProviders(
  ui: ReactElement,
  {
    controller,
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    }),
  }: {
    controller?: SessionController;
    /** Pass one to look at the cache afterwards. */
    queryClient?: QueryClient;
  } = {},
): RenderResult {
  const wrap = (node: ReactNode): ReactElement => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        {controller ? (
          <SessionControllerProvider controller={controller}>{node}</SessionControllerProvider>
        ) : (
          node
        )}
      </QueryClientProvider>
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
