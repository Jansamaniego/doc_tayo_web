import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { i18n } from '@/i18n/index.ts';
import { routeTree } from '@/routeTree.gen.ts';
import { server } from '@/test/msw/server.ts';

function renderApp() {
  server.use(
    http.get('http://localhost:3000/api/health', () => HttpResponse.json({ status: 'ok' })),
  );
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>,
  );
  return router;
}

describe('RootLayout focus handling', () => {
  it('has a skip link as the very first thing, and does not move focus on the first load', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1, name: 'DocTayo' });
    // Nothing on the page may take the keyboard position before the person presses a key.
    expect(screen.getByRole('main')).not.toHaveFocus();
    expect(document.activeElement).toBe(document.body);
  });

  it('moves focus to the main content after a real navigation, so keyboard and screen-reader users start at the new page', async () => {
    const router = renderApp();
    await screen.findByRole('heading', { level: 1, name: 'DocTayo' });
    await act(async () => {
      await router.navigate({ to: '/nowhere' as never });
    });
    await waitFor(() => {
      expect(screen.getByRole('main')).toHaveFocus();
    });
  });

  it('the skip link moves focus to the main content', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1, name: 'DocTayo' });
    screen.getByRole('link', { name: 'Skip to main content' }).click();
    expect(screen.getByRole('main')).toHaveFocus();
  });
});
