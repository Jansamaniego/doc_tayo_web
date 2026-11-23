import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Membership } from '@/api/session/session-store.ts';
import { forgetEmailToken } from '@/features/auth/fragment-token.ts';
import { sessionStore, type SessionState } from '@/api/session/session-store.ts';
import { SessionControllerProvider } from '@/features/auth/session-context.tsx';
import { i18n } from '@/i18n/index.ts';
import { fakeController } from '@/test/fake-session.tsx';

import { createAppRouter } from './router.ts';

const SUNRISE: Membership = {
  tenantId: 'a',
  tenantName: 'Sunrise Clinic',
  tenantStatus: 'active',
  membershipStatus: 'active',
  roles: [{ key: 'clinic_admin', name: 'Clinic admin' }],
};

const signedIn = (
  overrides: Partial<Extract<SessionState, { status: 'signed-in' }>> = {},
): void => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'u1', email: 'ana@example.com', fullName: 'Ana Cruz' },
    memberships: [SUNRISE],
    activeTenantId: 'a',
    permissions: ['tenant.read', 'branches.read'],
    ...overrides,
  });
};

function renderAt(path: string, controller = fakeController()) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  const result = render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <SessionControllerProvider controller={controller}>
          <RouterProvider router={router} />
        </SessionControllerProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { router, controller, ...result };
}

afterEach(() => {
  forgetEmailToken();
  sessionStore.set({ status: 'signed-out' });
  window.history.replaceState(null, '', '/');
});

describe('route guards', () => {
  it('sends a signed-out person to the sign-in page and remembers where they were going', async () => {
    sessionStore.set({ status: 'signed-out' });
    const { router } = renderAt('/select-clinic');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toMatchObject({ redirect: '/select-clinic' });
  });

  it('sends a signed-in person with no active clinic to the clinic picker', async () => {
    signedIn({ activeTenantId: null, permissions: [] });
    const { router } = renderAt('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Choose a clinic' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/select-clinic');
  });

  it('shows the home page, inside the app shell, to a signed-in person with an active clinic', async () => {
    signedIn();
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: /Ana/ })).toBeInTheDocument();
    expect(screen.getAllByText('Sunrise Clinic').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('moves a signed-in person away from the sign-in page, to where they were going', async () => {
    signedIn({ activeTenantId: null, permissions: [] });
    const { router } = renderAt('/login?redirect=/select-clinic');
    await screen.findByRole('heading', { level: 1, name: 'Choose a clinic' });
    expect(router.state.location.pathname).toBe('/select-clinic');
  });

  it('never follows a redirect to another site', async () => {
    signedIn();
    const { router } = renderAt('/login?redirect=//evil.example.com');
    await screen.findByRole('heading', { level: 1, name: /Ana/ });
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('sign-in page', () => {
  it('explains why the person was signed out', async () => {
    sessionStore.set({ status: 'signed-out', notice: 'inactive' });
    renderAt('/login');
    expect(await screen.findByText(/not used for 10 minutes/)).toBeInTheDocument();
  });

  it.each([
    ['password-reset', 'Your password was saved. Sign in with your new password.'],
    ['account-ready', 'Your account is ready. Sign in to start.'],
    ['invitation-accepted', 'You have joined the clinic. Sign in to open it.'],
  ])('confirms %s after the emailed-link flows', async (notice, text) => {
    renderAt(`/login?notice=${notice}`);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('has one main landmark and no accessibility violations', async () => {
    const { container } = renderAt('/login');
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('pages reached from an email link', () => {
  it('reads the token from the address fragment and removes it from the address bar', async () => {
    window.history.replaceState(null, '', '/reset-password#token=abc123');
    renderAt('/reset-password');
    expect(await screen.findByRole('button', { name: 'Save new password' })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });

  it.each(['/reset-password', '/account-setup', '/accept-invitation'])(
    '%s without a token says the link is not valid',
    async (path) => {
      renderAt(path);
      expect(await screen.findByText(/not valid or has expired/)).toBeInTheDocument();
    },
  );

  it('the forgot-password page is open to everyone', async () => {
    renderAt('/forgot-password');
    expect(await screen.findByRole('button', { name: 'Send me a link' })).toBeInTheDocument();
  });
});

describe('app shell', () => {
  it('signs out from the user menu', async () => {
    signedIn();
    const { controller } = renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: /Ana Cruz/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(controller.signOut).toHaveBeenCalledTimes(1);
  });

  it('asks before signing out on every device', async () => {
    signedIn();
    const { controller } = renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: /Ana Cruz/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out on all devices' }));
    expect(controller.signOutEverywhere).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out everywhere' }));
    expect(controller.signOutEverywhere).toHaveBeenCalledTimes(1);
  });

  it('opens the account page from the user menu', async () => {
    signedIn();
    const { router } = renderAt('/');
    await userEvent.click(await screen.findByRole('button', { name: /Ana Cruz/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'My account' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'My account' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/account');
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('keeps the account page for signed-in people only', async () => {
    sessionStore.set({ status: 'signed-out' });
    const { router } = renderAt('/account');
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    expect(router.state.location.search).toMatchObject({ redirect: '/account' });
  });

  it('has no accessibility violations', async () => {
    signedIn();
    const { container } = renderAt('/');
    await screen.findByRole('heading', { level: 1, name: /Ana/ });
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });

  it('leaves to the sign-in page when the session ends', async () => {
    signedIn();
    const { router } = renderAt('/');
    await screen.findByRole('heading', { level: 1, name: /Ana/ });
    act(() => {
      sessionStore.set({ status: 'signed-out', notice: 'expired' });
    });
    await act(() => router.invalidate());
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    vi.useRealTimers();
  });
});
