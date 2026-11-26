import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { UserDetailPage } from './UserDetailPage.tsx';

const API = 'http://localhost:3000/api/v1';
const user = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'ana@example.com',
  fullName: 'Ana Cruz',
  status: 'active',
  platformRole: 'none',
  practitionerProfileId: null,
  membershipCount: 2,
  ...over,
});
const serveUser = (over: Record<string, unknown> = {}): void => {
  server.use(http.get(`${API}/admin/users/u1`, () => HttpResponse.json({ data: user(over) })));
};
const errorBody = (status: number, code: string) =>
  HttpResponse.json({ error: { status, code, message: 'x', requestId: 'req-6' } }, { status });

function signInAs(id: string) {
  sessionStore.set({
    status: 'signed-in',
    user: { id, email: 'me@doctayo.test', fullName: 'Platform Admin' },
    memberships: [],
    activeTenantId: null,
    permissions: [],
    platformRole: 'platform_admin',
    practitionerProfileId: null,
  });
}
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

function renderDetail(onMissing = vi.fn()) {
  signInAs('admin-1');
  renderWithProviders(<UserDetailPage userId="u1" onMissing={onMissing} />);
  return onMissing;
}

describe('UserDetailPage', () => {
  it('shows the account: name, email, status, platform role and number of clinics', async () => {
    serveUser({ platformRole: 'platform_admin' });
    renderDetail();
    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Cruz' })).toBeInTheDocument();
    const page = document.body;
    expect(page).toHaveTextContent('ana@example.com');
    expect(page).toHaveTextContent('Active');
    expect(page).toHaveTextContent('Platform admin');
    expect(page).toHaveTextContent('2');
  });

  it('offers Deactivate for an active account, after a confirmation that says what happens', async () => {
    serveUser();
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${API}/admin/users/u1/status`, async ({ request }) => {
        bodies.push(await request.json());
        serveUser({ status: 'deactivated' });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      'Ana Cruz is signed out on every device and cannot sign in until you reactivate the account.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    expect(bodies).toEqual([{ status: 'deactivated' }]);
  });

  it('offers Reactivate for a deactivated account', async () => {
    serveUser({ status: 'deactivated' });
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${API}/admin/users/u1/status`, async ({ request }) => {
        bodies.push(await request.json());
        serveUser({ status: 'active' });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Reactivate' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reactivate' }),
    );
    expect(await screen.findByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(bodies).toEqual([{ status: 'active' }]);
  });

  it('does nothing when the confirmation is cancelled', async () => {
    serveUser();
    const sent = vi.fn();
    server.use(
      http.patch(`${API}/admin/users/u1/status`, () => {
        sent();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(sent).not.toHaveBeenCalled();
  });

  it('has no buttons for a pending account and explains why', async () => {
    serveUser({ status: 'pending' });
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: /Deactivate|Reactivate/ })).not.toBeInTheDocument();
    expect(screen.getByText(/has not set a password yet/)).toBeInTheDocument();
  });

  it('has no buttons on your own account and explains why', async () => {
    serveUser({ id: 'u1' });
    signInAs('u1');
    renderWithProviders(<UserDetailPage userId="u1" onMissing={() => undefined} />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: /Deactivate|Reactivate/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('You cannot change the status of your own account.'),
    ).toBeInTheDocument();
  });

  it('explains SELF_ACTION_FORBIDDEN the same way if the server refuses', async () => {
    serveUser();
    server.use(
      http.patch(`${API}/admin/users/u1/status`, () => errorBody(403, 'SELF_ACTION_FORBIDDEN')),
    );
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate' }),
    );
    expect(
      await screen.findByText('You cannot change the status of your own account.'),
    ).toBeInTheDocument();
  });

  it('reloads and explains when the status changed under you (409)', async () => {
    serveUser();
    server.use(
      http.patch(`${API}/admin/users/u1/status`, () => {
        serveUser({ status: 'deactivated' });
        return errorBody(409, 'CONFLICT');
      }),
    );
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate' }),
    );
    expect(await screen.findByText(/changed by someone else/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  });

  it('goes back to the list when the account does not exist (404)', async () => {
    server.use(http.get(`${API}/admin/users/u1`, () => errorBody(404, 'NOT_FOUND')));
    const onMissing = renderDetail();
    await waitFor(() => {
      expect(onMissing).toHaveBeenCalledTimes(1);
    });
  });

  it('shows other failures with the request id', async () => {
    server.use(http.get(`${API}/admin/users/u1`, () => errorBody(503, 'SERVICE_UNAVAILABLE')));
    renderDetail();
    expect(await screen.findByText(/req-6/)).toBeInTheDocument();
  });

  it('has no accessibility violations, with and without the dialog', async () => {
    serveUser();
    signInAs('admin-1');
    const { container } = renderWithProviders(
      <UserDetailPage userId="u1" onMissing={() => undefined} />,
    );
    await screen.findByRole('heading', { level: 1 });
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await screen.findByRole('alertdialog');
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
