import { I18nProvider } from '@lingui/react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { i18n } from '@/i18n/index.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { LeaveGuard } from './leave-guard.tsx';

function renderApp(shouldBlock: () => boolean) {
  const root = createRootRoute({ component: Outlet });
  const form = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => (
      <>
        <h1>The form</h1>
        {/* This little router is not the app's, whose route list types `to`. */}
        <Link to={'/other' as never}>Go elsewhere</Link>
        <LeaveGuard shouldBlock={shouldBlock} />
      </>
    ),
  });
  const other = createRoute({
    getParentRoute: () => root,
    path: '/other',
    component: () => <h1>Elsewhere</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([form, other]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return render(
    <I18nProvider i18n={i18n}>
      <RouterProvider router={router as never} />
    </I18nProvider>,
  );
}

describe('LeaveGuard (leaving a page with typed input)', () => {
  it('lets the person leave when there is nothing to lose', async () => {
    renderApp(() => false);
    await userEvent.click(await screen.findByRole('link', { name: 'Go elsewhere' }));
    expect(await screen.findByRole('heading', { name: 'Elsewhere' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks first, and Stay keeps the page', async () => {
    renderApp(() => true);
    await userEvent.click(await screen.findByRole('link', { name: 'Go elsewhere' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Leave without saving?');
    expect(await axe(document.body)).toHaveNoViolations();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(screen.getByRole('heading', { name: 'The form' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('Leave goes where the person was going', async () => {
    renderApp(() => true);
    await userEvent.click(await screen.findByRole('link', { name: 'Go elsewhere' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Leave' }),
    );
    expect(await screen.findByRole('heading', { name: 'Elsewhere' })).toBeInTheDocument();
  });

  it('does nothing outside a router', () => {
    renderWithProviders(<LeaveGuard shouldBlock={() => true} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
