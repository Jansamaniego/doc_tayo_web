import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { fakeController } from '@/test/fake-session.tsx';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { PractitionerActions } from './PractitionerActions.tsx';

const API = 'http://localhost:3000/api/v1';
const profile = (isActive = true) => ({
  id: 'pr1',
  membershipId: 'm1',
  displayName: 'Dr. Ana Cruz, MD',
  specialization: null,
  prcLicenseNumber: null,
  ptrNumber: null,
  isActive,
  schedule: [],
});

function setup({ isActive = true, reply }: { isActive?: boolean; reply?: () => Response } = {}) {
  const sent: { body: unknown; tenant: string | null }[] = [];
  server.use(
    http.patch(`${API}/practitioners/pr1`, async ({ request }) => {
      sent.push({
        body: await request.json(),
        tenant: request.headers.get('x-expected-tenant-id'),
      });
      return reply ? reply() : HttpResponse.json({ data: profile(!isActive) });
    }),
  );
  const controller = fakeController();
  const view = renderWithProviders(<PractitionerActions practitioner={profile(isActive)} />, {
    controller,
  });
  return { sent, controller, ...view };
}

beforeEach(() => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me' },
    memberships: [],
    activeTenantId: 'clinic-a',
    permissions: ['practitioners.manage'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('PractitionerActions', () => {
  it('offers Edit profile and Deactivate for an active practitioner', () => {
    setup();
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute(
      'href',
      '/practitioners/pr1/edit',
    );
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument();
  });

  it('Deactivate asks first, naming them, with Cancel focused', async () => {
    const { sent } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Deactivate Dr. Ana Cruz, MD?');
    expect(dialog).toHaveTextContent(
      'Dr. Ana Cruz, MD will no longer be offered when booking. Nothing is deleted.',
    );
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(sent).toEqual([]);
  });

  it('confirming sends isActive false in the opened clinic and reloads the session', async () => {
    const { sent, controller } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate' }),
    );
    await waitFor(() => {
      expect(controller.refreshPermissions).toHaveBeenCalled();
    });
    expect(sent).toEqual([{ body: { isActive: false }, tenant: 'clinic-a' }]);
  });

  it('an inactive practitioner offers Reactivate, which needs no confirmation', async () => {
    const { sent, controller } = setup({ isActive: false });
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate' }));
    await waitFor(() => {
      expect(controller.refreshPermissions).toHaveBeenCalled();
    });
    expect(sent).toEqual([{ body: { isActive: true }, tenant: 'clinic-a' }]);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows a failure with its request id', async () => {
    setup({
      isActive: false,
      reply: () =>
        HttpResponse.json(
          { error: { status: 500, code: 'INTERNAL_ERROR', message: 'x', requestId: 'req-ac' } },
          { status: 500 },
        ),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate' }));
    expect(await screen.findByText(/req-ac/)).toBeInTheDocument();
  });

  it('has no accessibility violations, plain and with the dialog', async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await screen.findByRole('alertdialog');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
