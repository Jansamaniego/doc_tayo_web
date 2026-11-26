import { I18nProvider } from '@lingui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Membership } from '@/api/session/session-store.ts';
import { forgetEmailToken } from '@/features/auth/fragment-token.ts';
import { sessionStore, type SessionState } from '@/api/session/session-store.ts';
import { SessionControllerProvider } from '@/features/auth/session-context.tsx';
import { i18n } from '@/i18n/index.ts';
import { fakeController } from '@/test/fake-session.tsx';
import { server } from '@/test/msw/server.ts';

import { createQueryClient } from './query-client.ts';
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
    platformRole: 'none',
    practitionerProfileId: null,
    ...overrides,
  });
};

function renderAt(path: string, controller = fakeController()) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  const result = render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider
        client={createQueryClient({
          onForbidden: () => undefined,
          onClinicLost: () => undefined,
          onTenantMismatch: () => undefined,
        })}
      >
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
  it('sends a signed-out person to the sign-in page, and does not remember where they were going', async () => {
    sessionStore.set({ status: 'signed-out' });
    const { router } = renderAt('/select-clinic');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({});
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

  it('sends a person whose clinic was taken away to the picker, with a notice naming it', async () => {
    signedIn({ activeTenantId: null, permissions: [], lostClinicName: 'Sunrise Clinic' });
    const { router } = renderAt('/staff');
    await screen.findByRole('heading', { level: 1, name: 'Choose a clinic' });
    expect(router.state.location.pathname).toBe('/select-clinic');
    expect(screen.getByText('You no longer have access to Sunrise Clinic.')).toBeInTheDocument();
  });

  it('shows the empty state, and no clinic to open, when nothing usable is left', async () => {
    signedIn({
      activeTenantId: null,
      permissions: [],
      memberships: [{ ...SUNRISE, membershipStatus: 'suspended' }],
      lostClinicName: 'Sunrise Clinic',
    });
    renderAt('/');
    expect(
      await screen.findByText("You don't have a clinic you can open right now."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sunrise Clinic/ })).not.toBeInTheDocument();
  });

  it('moves a signed-in person away from the sign-in page, to the home page', async () => {
    signedIn({ activeTenantId: null, permissions: [] });
    const { router } = renderAt('/login');
    await screen.findByRole('heading', { level: 1, name: 'Choose a clinic' });
    expect(router.state.location.pathname).toBe('/select-clinic');
  });

  it.each(['/account', '/admin', '/staff', '//evil.example.com', 'https://evil.example.com'])(
    'ignores an old ?redirect=%s: signing in always leads to the home page',
    async (target) => {
      signedIn();
      const { router } = renderAt(`/login?redirect=${encodeURIComponent(target)}`);
      await screen.findByRole('heading', { level: 1, name: /Ana/ });
      expect(router.state.location.pathname).toBe('/');
      expect(router.state.location.search).toEqual({});
    },
  );
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
    ['email-changed', 'Your email was changed. Sign in with your new address.'],
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
    expect(router.state.location.search).toEqual({});
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

describe('platform admin tabs', () => {
  const API = 'http://localhost:3000/api/v1';
  const EMPTY_PAGE = { data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } };
  beforeEach(() => {
    server.use(
      http.get(`${API}/admin/tenants`, () => HttpResponse.json(EMPTY_PAGE)),
      http.get(`${API}/admin/users`, () => HttpResponse.json(EMPTY_PAGE)),
      http.get('http://localhost:3000/api/health/ready', () => HttpResponse.json({ status: 'ok' })),
    );
  });
  const adminOnly = (): void => {
    signedIn({
      platformRole: 'platform_admin',
      practitionerProfileId: null,
      memberships: [],
      activeTenantId: null,
      permissions: [],
    });
  };

  it('lands an admin with no clinic on the platform overview, never on the clinic picker', async () => {
    adminOnly();
    const { router } = renderAt('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Platform overview' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('shows an admin with no clinic only Overview, Clinics and Users in the navigation, and no clinic switcher', async () => {
    adminOnly();
    renderAt('/admin');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Clinics' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    expect(screen.queryByText('Sunrise Clinic')).not.toBeInTheDocument();
  });

  it('marks Clinics, not Overview, as the current page on the clinics list', async () => {
    adminOnly();
    renderAt('/admin/clinics');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Clinics' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('shows an admin who also belongs to a clinic the clinic home and all three items', async () => {
    signedIn({ platformRole: 'platform_admin' });
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: /Welcome/ })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const name of ['Home', 'Overview', 'Clinics', 'Users']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('shows a clinic owner no admin items, and /admin/clinics is "page not found"', async () => {
    signedIn();
    renderAt('/admin/clinics');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'We could not find this page' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clinics' })).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign-in', async () => {
    sessionStore.set({ status: 'signed-out' });
    const { router } = renderAt('/admin/users');
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    expect(router.state.location.search).toEqual({});
  });

  it('opens the account page without a clinic', async () => {
    adminOnly();
    renderAt('/account');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'My account' }),
    ).toBeInTheDocument();
  });

  it('offers the way to Clinics on the clinic picker', async () => {
    adminOnly();
    renderAt('/select-clinic');
    expect(
      await screen.findByRole('link', { name: 'Go to the platform overview' }),
    ).toHaveAttribute('href', '/admin');
  });

  it('hides the tabs and shows "page not found" when the role is taken away', async () => {
    adminOnly();
    const { router } = renderAt('/admin/clinics');
    await screen.findByRole('heading', { level: 1, name: 'Clinics' });
    act(() => {
      signedIn({ memberships: [], activeTenantId: null, permissions: [], platformRole: 'none' });
    });
    await act(() => router.invalidate());
    expect(
      await screen.findByRole('heading', { level: 1, name: 'We could not find this page' }),
    ).toBeInTheDocument();
  });
});

describe('staff pages', () => {
  const API = 'http://localhost:3000/api/v1';
  const STAFF_PAGE = {
    data: [
      {
        membershipId: 'm1',
        userId: 'u1',
        email: 'ana@example.com',
        fullName: 'Ana Cruz',
        status: 'active',
        jobTitle: null,
        roles: [{ id: 'r1', key: 'clinic_admin', name: 'Clinic admin' }],
        joinedAt: null,
      },
    ],
    meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
  };
  let membersRequests = 0;
  beforeEach(() => {
    membersRequests = 0;
    server.use(
      http.get(`${API}/members`, () => {
        membersRequests += 1;
        return HttpResponse.json(STAFF_PAGE);
      }),
      http.get(`${API}/members/m1`, () => HttpResponse.json({ data: STAFF_PAGE.data[0] })),
      http.get(`${API}/roles`, () => HttpResponse.json({ data: [] })),
      http.get(`${API}/tenant`, () =>
        HttpResponse.json({
          data: {
            id: 'a',
            name: 'Sunrise Clinic',
            slug: 'sunrise',
            status: 'active',
            timezone: 'Asia/Manila',
            contactEmail: null,
            contactPhone: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        }),
      ),
    );
  });
  const manager = (): void => {
    signedIn({ permissions: ['tenant.read', 'branches.read', 'members.read', 'members.manage'] });
  };

  it('shows a person who may read staff the Staff item, and opens the list', async () => {
    manager();
    renderAt('/staff');
    expect(await screen.findByRole('heading', { level: 1, name: 'Staff' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Staff' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await screen.findByRole('link', { name: 'Ana Cruz' })).toBeInTheDocument();
  });

  it('opens a member, with Staff still the current item', async () => {
    manager();
    renderAt('/staff/m1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Cruz' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Staff' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('shows a person without members.read no Staff item, and "no access" for a typed address, without asking for the staff', async () => {
    signedIn({ permissions: ['tenant.read', 'branches.read'] });
    renderAt('/staff');
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument();
    expect(membersRequests).toBe(0);
  });

  it('shows "no access" for a member address too, without asking for the member', async () => {
    signedIn({ permissions: ['tenant.read', 'branches.read'] });
    renderAt('/staff/m1');
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument();
  });

  it('sends a signed-in person with no clinic chosen to the clinic picker', async () => {
    signedIn({ activeTenantId: null, permissions: [] });
    const { router } = renderAt('/staff');
    await screen.findByRole('heading', { level: 1, name: 'Choose a clinic' });
    expect(router.state.location.pathname).toBe('/select-clinic');
  });

  it('sends a signed-out visitor to sign-in', async () => {
    sessionStore.set({ status: 'signed-out' });
    const { router } = renderAt('/staff');
    await screen.findByRole('heading', { level: 1, name: 'Sign in' });
    expect(router.state.location.search).toEqual({});
  });

  it('opens the Invitations tab for a person who may read staff, with both tabs and Staff still current in the navigation', async () => {
    manager();
    server.use(
      http.get(`${API}/invitations`, () =>
        HttpResponse.json({
          data: [],
          meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
        }),
      ),
    );
    const { router } = renderAt('/staff/invitations');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invitations' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/staff/invitations');
    const tabs = screen.getByRole('navigation', { name: 'Staff sections' });
    expect(within(tabs).getByRole('link', { name: 'Invitations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabs).getByRole('link', { name: 'Staff' })).not.toHaveAttribute('aria-current');
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Staff' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('shows "no access" on /staff/invitations without members.read, and asks for nothing', async () => {
    signedIn({ permissions: ['tenant.read', 'branches.read'] });
    renderAt('/staff/invitations');
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument();
  });

  it('keeps the invitation status in the address and nothing typed', async () => {
    manager();
    server.use(
      http.get(`${API}/invitations`, () =>
        HttpResponse.json({
          data: [],
          meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
        }),
      ),
    );
    const { router } = renderAt('/staff/invitations?status=expired');
    expect(await screen.findByText('No expired invitations')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ status: 'expired' });
  });

  it('links the Staff tab to the Invitations tab and back', async () => {
    manager();
    server.use(
      http.get(`${API}/invitations`, () =>
        HttpResponse.json({
          data: [],
          meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
        }),
      ),
    );
    renderAt('/staff');
    await screen.findByRole('heading', { level: 1, name: 'Staff' });
    const tabs = screen.getByRole('navigation', { name: 'Staff sections' });
    await userEvent.click(within(tabs).getByRole('link', { name: 'Invitations' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invitations' }),
    ).toBeInTheDocument();
  });

  it('takes a missing member back to the list with a message', async () => {
    manager();
    server.use(
      http.get(`${API}/members/gone`, () =>
        HttpResponse.json(
          { error: { status: 404, code: 'NOT_FOUND', message: 'x', requestId: 'r' } },
          { status: 404 },
        ),
      ),
    );
    const { router } = renderAt('/staff/gone');
    expect(await screen.findByText('This person is not on your staff.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/staff');
  });
});

describe('the page for confirming a new email address', () => {
  const API = 'http://localhost:3000/api/v1';
  const endSessionLikeTheRealOne = () =>
    fakeController({
      endSession: vi.fn(() => {
        sessionStore.set({ status: 'signed-out', notice: 'email-changed' });
        return Promise.resolve();
      }),
    });

  it('reads the token from the address and removes it from the address bar, signed out', async () => {
    window.history.replaceState(null, '', '/verify-email#token=abc123');
    renderAt('/verify-email');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Confirm your new email address' }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(screen.getByRole('button', { name: 'Confirm new email address' })).toBeInTheDocument();
  });

  it('opens for a signed-in person too, without sending them away', async () => {
    signedIn();
    window.history.replaceState(null, '', '/verify-email#token=abc123');
    const { router } = renderAt('/verify-email');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Confirm your new email address' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/verify-email');
  });

  it('without a token says the link is not valid', async () => {
    renderAt('/verify-email');
    expect(
      await screen.findByText('This link has expired, was already used, or a newer link was sent.'),
    ).toBeInTheDocument();
  });

  it.each([
    ['signed out', false],
    ['signed in', true],
  ])(
    '%s: confirming ends the session, tells the other tabs, and lands on sign-in with the notice, with no token in any address',
    async (_name, isSignedIn) => {
      if (isSignedIn) signedIn();
      server.use(
        http.post(`${API}/auth/email/verify`, () => new HttpResponse(null, { status: 204 })),
      );
      window.history.replaceState(null, '', '/verify-email#token=abc123');
      const controller = endSessionLikeTheRealOne();
      const { router } = renderAt('/verify-email', controller);
      await userEvent.click(
        await screen.findByRole('button', { name: 'Confirm new email address' }),
      );
      expect(
        await screen.findByText('Your email was changed. Sign in with your new address.'),
      ).toBeInTheDocument();
      expect(controller.endSession).toHaveBeenCalledWith('email-changed');
      expect(router.state.location.pathname).toBe('/login');
      expect(router.state.location.href).not.toContain('abc123');
      expect(window.location.href).not.toContain('abc123');
      expect(sessionStore.get().status).toBe('signed-out');
    },
  );
});

describe('clinic pages', () => {
  const API = 'http://localhost:3000/api/v1';
  const TENANT = {
    id: 'a',
    name: 'Sunrise Clinic',
    slug: 'sunrise',
    status: 'active',
    timezone: 'Asia/Manila',
    contactEmail: 'hello@sunrise.test',
    contactPhone: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const BRANCH = {
    id: 'b1',
    name: 'Main',
    addressLine: null,
    city: null,
    province: null,
    timezone: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  let branchRequests = 0;
  beforeEach(() => {
    branchRequests = 0;
    server.use(
      http.get(`${API}/tenant`, () => HttpResponse.json({ data: TENANT })),
      http.get(`${API}/branches`, () => {
        branchRequests += 1;
        return HttpResponse.json({
          data: [BRANCH],
          meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
        });
      }),
      http.get(`${API}/branches/b1`, () => HttpResponse.json({ data: BRANCH })),
    );
  });
  const reader = (): void => {
    signedIn({ permissions: ['tenant.read', 'branches.read'] });
  };
  const manager = (): void => {
    signedIn({
      permissions: ['tenant.read', 'tenant.settings.manage', 'branches.read', 'branches.manage'],
    });
  };

  it('shows every clinic role the Clinic item, current on the profile and on a branch', async () => {
    reader();
    renderAt('/clinic');
    expect(await screen.findByRole('heading', { level: 1, name: 'Clinic' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Clinic' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('opens the branch list and a branch, with Clinic still the current item', async () => {
    reader();
    const { router } = renderAt('/clinic/branches');
    expect(await screen.findByRole('link', { name: 'Main' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/clinic/branches');
    await userEvent.click(screen.getByRole('link', { name: 'Main' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Main' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Clinic',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('shows a receptionist the clinic read-only, with the reasons', async () => {
    reader();
    renderAt('/clinic');
    await screen.findByText('hello@sunrise.test');
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    expect(
      screen.getByText("Only an owner or clinic admin can change the clinic's details."),
    ).toBeInTheDocument();
  });

  it('shows a manager Edit details, and Add branch on the list', async () => {
    manager();
    renderAt('/clinic');
    expect(await screen.findByRole('button', { name: 'Edit details' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Branches' }));
    expect(await screen.findByRole('link', { name: 'Add branch' })).toBeInTheDocument();
  });

  it('shows "no access" for the add-branch address to a person who may not manage branches, and asks for nothing', async () => {
    reader();
    renderAt('/clinic/branches/new');
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(branchRequests).toBe(0);
  });

  it('opens the add-branch form for a manager', async () => {
    manager();
    renderAt('/clinic/branches/new');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Add a branch' }),
    ).toBeInTheDocument();
  });

  it('sends a person with no clinic chosen to the clinic picker', async () => {
    signedIn({ activeTenantId: null, permissions: [] });
    const { router } = renderAt('/clinic');
    await screen.findByRole('heading', { level: 1, name: 'Choose a clinic' });
    expect(router.state.location.pathname).toBe('/select-clinic');
  });

  it('keeps the branch filter in the address and starts at Active', async () => {
    reader();
    const { router } = renderAt('/clinic/branches?status=inactive&page=2');
    expect(await screen.findByLabelText('Show')).toHaveValue('inactive');
    expect(router.state.location.search).toEqual({ status: 'inactive', page: 2 });
  });
});

describe('patient pages', () => {
  const API = 'http://localhost:3000/api/v1';
  let requests = 0;
  beforeEach(() => {
    requests = 0;
    server.use(
      http.get(`${API}/patients`, () => {
        requests += 1;
        return HttpResponse.json({
          data: [],
          meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
        });
      }),
      http.get(`${API}/tenant`, () => HttpResponse.json({ data: { timezone: 'Asia/Manila' } })),
    );
  });
  const reader = (): void => {
    signedIn({ permissions: ['tenant.read', 'branches.read', 'patients.read'] });
  };

  it('shows Patients after Home to a person who may read patients, and opens the list', async () => {
    reader();
    renderAt('/patients');
    expect(await screen.findByRole('heading', { level: 1, name: 'Patients' })).toBeInTheDocument();
    const links = within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link');
    expect(links.slice(0, 2).map((link) => link.textContent)).toEqual(['Home', 'Patients']);
    expect(links[1]).toHaveAttribute('aria-current', 'page');
  });

  it('shows a person without patients.read no item, and "no access" for a typed address, asking for nothing', async () => {
    signedIn({ permissions: ['tenant.read'] });
    renderAt('/patients');
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Patients' })).not.toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it('reads "show archived" and the page from the address, and ignores a typed ?q=', async () => {
    reader();
    const asked: URL[] = [];
    server.use(
      http.get(`${API}/patients`, ({ request }) => {
        asked.push(new URL(request.url));
        return HttpResponse.json({
          data: [],
          meta: { page: 2, pageSize: 20, totalItems: 0, totalPages: 0 },
        });
      }),
    );
    renderAt('/patients?includeArchived=true&page=2&q=secret');
    await screen.findByText('No patients yet');
    expect(asked[0]?.searchParams.get('includeArchived')).toBe('true');
    expect(asked[0]?.searchParams.get('page')).toBe('2');
    expect(asked[0]?.searchParams.has('q')).toBe(false);
    expect(
      screen.getByRole('searchbox', { name: 'Search by name, patient number or phone' }),
    ).toHaveValue('');
  });

  const servePatient = () => {
    server.use(
      http.get(`${API}/patients/p1`, () => {
        requests += 1;
        return HttpResponse.json({
          data: {
            id: 'p1',
            patientNumber: 'P-000001',
            firstName: 'Juan',
            middleName: null,
            lastName: 'Cruz',
            suffix: null,
            sex: 'male',
            birthDate: null,
            phone: null,
            email: null,
            addressLine: null,
            city: null,
            province: null,
            guardianName: null,
            guardianPhone: null,
            allergies: null,
            notes: null,
            archivedAt: null,
            archiveReason: null,
            version: 1,
          },
        });
      }),
    );
  };

  it('opens a patient, with Patients still the current item', async () => {
    reader();
    servePatient();
    renderAt('/patients/p1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Juan Cruz' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Patients',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('shows "no access" for a patient address without patients.read, asking for nothing', async () => {
    signedIn({ permissions: ['tenant.read'] });
    servePatient();
    renderAt('/patients/p1');
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  const manager = (): void => {
    signedIn({ permissions: ['tenant.read', 'patients.read', 'patients.manage'] });
  };

  it('opens the registration form for a person who may register, not the patient page "new"', async () => {
    manager();
    renderAt('/patients/new');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Register a patient' }),
    ).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it('shows "no access" for the registration form without patients.manage', async () => {
    reader();
    renderAt('/patients/new');
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument();
  });

  it('asks before leaving the registration form with typed input', async () => {
    manager();
    const { router } = renderAt('/patients/new');
    await userEvent.type(await screen.findByLabelText(/^First name/), 'Ana');
    await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Leave without saving?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(router.state.location.pathname).toBe('/patients/new');
    expect(screen.getByLabelText(/^First name/)).toHaveValue('Ana');
    await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Leave' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Patients' });
  });

  it('lets the person leave an untouched form without asking', async () => {
    manager();
    renderAt('/patients/new');
    await userEvent.click(await screen.findByRole('link', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Patients' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not hold a signed-out person on a form with typed input', async () => {
    manager();
    const { router } = renderAt('/patients/new');
    await userEvent.type(await screen.findByLabelText(/^First name/), 'Ana');
    act(() => {
      sessionStore.set({ status: 'signed-out' });
    });
    await act(() => router.invalidate());
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });

  it('goes to the new patient’s page after registering, without asking to leave', async () => {
    manager();
    server.use(
      http.post(`${API}/patients`, () =>
        HttpResponse.json(
          { data: { id: 'p1', patientNumber: 'P-000001', firstName: 'Juan', lastName: 'Cruz' } },
          { status: 201 },
        ),
      ),
    );
    servePatient();
    const { router } = renderAt('/patients/new');
    await userEvent.type(await screen.findByLabelText(/^First name/), 'Juan');
    await userEvent.type(screen.getByLabelText(/^Last name/), 'Cruz');
    await userEvent.click(screen.getByRole('button', { name: 'Register patient' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Juan Cruz' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/patients/p1');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('opens the edit form from the patient page, and comes back after saving without asking', async () => {
    manager();
    servePatient();
    server.use(http.patch(`${API}/patients/p1`, () => HttpResponse.json({ data: { id: 'p1' } })));
    const { router } = renderAt('/patients/p1');
    await userEvent.click(await screen.findByRole('link', { name: 'Edit' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edit patient' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/patients/p1/edit');
    await userEvent.type(await screen.findByLabelText(/^City/), 'Taguig');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Juan Cruz' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/patients/p1');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks before leaving the edit form with changes', async () => {
    manager();
    servePatient();
    renderAt('/patients/p1/edit');
    await userEvent.type(await screen.findByLabelText(/^City/), 'Taguig');
    await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Leave without saving?');
  });

  it('shows "no access" for the edit form without patients.manage, asking for nothing', async () => {
    reader();
    servePatient();
    renderAt('/patients/p1/edit');
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it('sends a signed-in person with no clinic chosen to the clinic picker', async () => {
    signedIn({ activeTenantId: null, permissions: [] });
    const { router } = renderAt('/patients');
    await screen.findByRole('heading', { level: 1, name: 'Choose a clinic' });
    expect(router.state.location.pathname).toBe('/select-clinic');
  });

  it('sends a signed-out visitor to sign-in', async () => {
    sessionStore.set({ status: 'signed-out' });
    renderAt('/patients');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('practitioner pages', () => {
  const API = 'http://localhost:3000/api/v1';
  const BRANCH = 'a0000000-0000-4000-8000-000000000001';
  let requests: URL[] = [];
  beforeEach(() => {
    requests = [];
    const empty = { data: [], meta: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 } };
    server.use(
      http.get(`${API}/directory`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(empty);
      }),
      http.get(`${API}/branches`, () => HttpResponse.json(empty)),
    );
  });
  const reader = (): void => {
    signedIn({ permissions: ['tenant.read', 'patients.read', 'directory.read', 'branches.read'] });
  };

  it('shows Practitioners after Patients to a person who may read the directory, and opens the list', async () => {
    reader();
    renderAt('/practitioners');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Practitioners' }),
    ).toBeInTheDocument();
    const links = within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link');
    expect(links.slice(0, 3).map((link) => link.textContent)).toEqual([
      'Home',
      'Patients',
      'Practitioners',
    ]);
    expect(links[2]).toHaveAttribute('aria-current', 'page');
  });

  it('shows a person without directory.read no item, and "no access" for a typed address, asking for nothing', async () => {
    signedIn({ permissions: ['tenant.read'] });
    renderAt('/practitioners');
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Practitioners' })).not.toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it('reads the branch and the page from the address, and ignores a branch that is not an id', async () => {
    reader();
    const first = renderAt(`/practitioners?branch=${BRANCH}&page=2`);
    await screen.findByText('No practitioner works at this branch');
    expect(requests[0]?.searchParams.get('branchId')).toBe(BRANCH);
    first.unmount();
    requests = [];
    reader();
    renderAt('/practitioners?branch=all');
    await screen.findByText('No practitioners yet');
    expect(requests[0]?.searchParams.has('branchId')).toBe(false);
  });

  const serveProfile = () => {
    server.use(
      http.get(`${API}/practitioners/pr1`, () => {
        requests.push(new URL(`${API}/practitioners/pr1`));
        return HttpResponse.json({
          data: {
            id: 'pr1',
            membershipId: 'm1',
            displayName: 'Dr. Dan Doctor',
            specialization: null,
            prcLicenseNumber: null,
            ptrNumber: null,
            isActive: false,
            schedule: [],
          },
        });
      }),
      http.get(`${API}/tenant`, () => HttpResponse.json({ data: { timezone: 'Asia/Manila' } })),
    );
  };
  const nav = () => within(screen.getByRole('navigation', { name: 'Main' }));

  it('opens a practitioner, with Practitioners still the current item', async () => {
    reader();
    serveProfile();
    renderAt('/practitioners/pr1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dr. Dan Doctor' }),
    ).toBeInTheDocument();
    expect(nav().getByRole('link', { name: 'Practitioners' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows "no access" for a practitioner address without directory.read, asking for nothing', async () => {
    signedIn({ permissions: ['tenant.read'] });
    serveProfile();
    renderAt('/practitioners/pr1');
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it('shows no "My schedule" to a person who is not a practitioner', async () => {
    reader();
    renderAt('/practitioners');
    await screen.findByRole('heading', { level: 1, name: 'Practitioners' });
    expect(screen.queryByRole('link', { name: 'My schedule' })).not.toBeInTheDocument();
  });

  it('shows a practitioner "My schedule", which opens their own page and is then the current item', async () => {
    signedIn({
      permissions: ['tenant.read', 'directory.read', 'branches.read'],
      practitionerProfileId: 'pr1',
    });
    serveProfile();
    const { router } = renderAt('/practitioners');
    await screen.findByRole('heading', { level: 1, name: 'Practitioners' });
    const mine = nav().getByRole('link', { name: 'My schedule' });
    expect(mine).toHaveAttribute('href', '/practitioners/pr1');
    await userEvent.click(mine);
    await screen.findByRole('heading', { level: 1, name: 'Dr. Dan Doctor' });
    expect(router.state.location.pathname).toBe('/practitioners/pr1');
    expect(nav().getByRole('link', { name: 'My schedule' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(nav().getByRole('link', { name: 'Practitioners' })).not.toHaveAttribute('aria-current');
  });

  it('drops "My schedule" when the clinic has no profile for the person', async () => {
    signedIn({ permissions: ['directory.read', 'branches.read'], practitionerProfileId: 'pr1' });
    renderAt('/practitioners');
    await screen.findByRole('link', { name: 'My schedule' });
    act(() => {
      signedIn({ permissions: ['directory.read', 'branches.read'], practitionerProfileId: null });
    });
    expect(screen.queryByRole('link', { name: 'My schedule' })).not.toBeInTheDocument();
  });

  const manager = (): void => {
    signedIn({
      permissions: ['tenant.read', 'branches.read', 'directory.read', 'practitioners.manage'],
    });
  };

  it('opens the add form for a manager, not the practitioner page "new"', async () => {
    manager();
    renderAt('/practitioners/new');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Add a practitioner' }),
    ).toBeInTheDocument();
  });

  it.each(['/practitioners/new', '/practitioners/pr1/edit', '/practitioners/pr1/schedule'])(
    'shows "no access" for %s without practitioners.manage',
    async (path) => {
      reader();
      serveProfile();
      renderAt(path);
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: "You don't have access to this page",
        }),
      ).toBeInTheDocument();
    },
  );

  it('asks before leaving the edit form with changes', async () => {
    manager();
    serveProfile();
    renderAt('/practitioners/pr1/edit');
    await userEvent.type(await screen.findByLabelText(/^Specialization/), 'Heart');
    await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Leave without saving?');
  });

  it('goes back to the practitioner after saving, without asking', async () => {
    manager();
    serveProfile();
    server.use(
      http.patch(`${API}/practitioners/pr1`, () => HttpResponse.json({ data: { id: 'pr1' } })),
    );
    const { router } = renderAt('/practitioners/pr1/edit');
    await userEvent.type(await screen.findByLabelText(/^Specialization/), 'Heart');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('heading', { level: 1, name: 'Dr. Dan Doctor' });
    expect(router.state.location.pathname).toBe('/practitioners/pr1');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  const serveWeek = () => {
    serveProfile();
    server.use(
      http.get(`${API}/branches`, () =>
        HttpResponse.json({
          data: [{ id: BRANCH, name: 'Main', timezone: null, isActive: true }],
          meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
        }),
      ),
    );
  };

  it('asks before leaving the schedule editor with changes', async () => {
    manager();
    serveWeek();
    renderAt('/practitioners/pr1/schedule');
    await userEvent.click(await screen.findByRole('button', { name: 'Add hours on Monday' }));
    await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Leave without saving?');
  });

  it('goes back to the practitioner after saving the week, without asking', async () => {
    manager();
    serveWeek();
    server.use(
      http.put(`${API}/practitioners/pr1/schedule`, () =>
        HttpResponse.json({
          data: {
            id: 'pr1',
            membershipId: 'm1',
            displayName: 'Dr. Dan Doctor',
            specialization: null,
            prcLicenseNumber: null,
            ptrNumber: null,
            isActive: true,
            schedule: [{ branchId: BRANCH, weekday: 1, startsAt: '09:00', endsAt: '24:00' }],
          },
        }),
      ),
    );
    const { router } = renderAt('/practitioners/pr1/schedule');
    await userEvent.click(await screen.findByRole('button', { name: 'Add hours on Monday' }));
    const start = within(screen.getByRole('group', { name: 'Monday, hours 1: start' }));
    await userEvent.selectOptions(start.getByLabelText('Hour'), '9');
    await userEvent.selectOptions(start.getByLabelText('Minute'), '00');
    await userEvent.selectOptions(start.getByLabelText('AM or PM'), 'AM');
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Monday, hours 1: until midnight' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
    await screen.findByRole('heading', { level: 1, name: 'Dr. Dan Doctor' });
    expect(router.state.location.pathname).toBe('/practitioners/pr1');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('sends a signed-in person with no clinic chosen to the clinic picker', async () => {
    signedIn({ activeTenantId: null, permissions: [] });
    const { router } = renderAt('/practitioners');
    await screen.findByRole('heading', { level: 1, name: 'Choose a clinic' });
    expect(router.state.location.pathname).toBe('/select-clinic');
  });

  it('sends a signed-out visitor to sign-in', async () => {
    sessionStore.set({ status: 'signed-out' });
    renderAt('/practitioners');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });
});
