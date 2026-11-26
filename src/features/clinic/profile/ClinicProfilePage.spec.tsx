import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { notify, ToastRegion } from '@/design-system/components/toast.tsx';
import { useMembers } from '@/features/staff/api/members.ts';
import { fakeController } from '@/test/fake-session.tsx';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { ClinicProfilePage } from './ClinicProfilePage.tsx';

const API = 'http://localhost:3000/api/v1';
const tenant = (over: Record<string, unknown> = {}) => ({
  id: 'clinic-a',
  name: 'Sunrise Clinic',
  slug: 'sunrise',
  status: 'active',
  timezone: 'Asia/Manila',
  contactEmail: 'hello@sunrise.test',
  contactPhone: '+639171234567',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});
const errorBody = (status: number, code: string, details: unknown[] = []) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-6', details } },
    { status },
  );

const MANAGER = ['tenant.read', 'tenant.settings.manage', 'branches.read', 'branches.manage'];
const READER = ['tenant.read', 'branches.read'];
const signIn = (permissions: string[]): void => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me Myself' },
    memberships: [
      {
        tenantId: 'clinic-a',
        tenantName: 'Sunrise Clinic',
        tenantStatus: 'active',
        membershipStatus: 'active',
        roles: [{ key: 'clinic_admin', name: 'Clinic admin' }],
      },
    ],
    activeTenantId: 'clinic-a',
    permissions,
    platformRole: 'none',
    practitionerProfileId: null,
  });
};
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
  notify.clear();
});

/** The clinic as the API serves it; a PATCH merges its body in, like the real one. */
function serve({
  current = tenant(),
  reply,
}: { current?: Record<string, unknown>; reply?: () => Response } = {}) {
  const state = { clinic: current, bodies: [] as unknown[], gets: 0, memberGets: 0 };
  server.use(
    http.get(`${API}/tenant`, () => {
      state.gets += 1;
      return HttpResponse.json({ data: state.clinic });
    }),
    http.patch(`${API}/tenant`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      state.bodies.push(body);
      if (reply) return reply();
      state.clinic = { ...state.clinic, ...body };
      return HttpResponse.json({ data: state.clinic });
    }),
    http.get(`${API}/members`, () => {
      state.memberGets += 1;
      return HttpResponse.json({
        data: [],
        meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      });
    }),
  );
  return state;
}

/** Stands in for any screen that shows clinic data with dates (the Staff list). */
function DatedScreen() {
  useMembers({});
  return null;
}

async function open(permissions: string[], options: Parameters<typeof serve>[0] = {}) {
  signIn(permissions);
  const state = serve(options);
  const controller = fakeController();
  const result = renderWithProviders(
    <>
      <ClinicProfilePage />
      <DatedScreen />
      <ToastRegion />
    </>,
    { controller },
  );
  await screen.findByRole('heading', { level: 1, name: 'Clinic' });
  await screen.findByText('Sunrise Clinic');
  return { state, controller, ...result };
}
async function startEditing() {
  await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
}
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save' }));

describe('ClinicProfilePage: reading', () => {
  it('shows the details in words, with the web address explained as fixed', async () => {
    await open(MANAGER);
    const details = screen.getByRole('region', { name: 'Details' });
    expect(within(details).getByText('Sunrise Clinic')).toBeInTheDocument();
    expect(within(details).getByText('sunrise')).toBeInTheDocument();
    expect(
      within(details).getByText('Set when the clinic was created; it cannot be changed.'),
    ).toBeInTheDocument();
    expect(within(details).getByText('Asia/Manila')).toBeInTheDocument();
    expect(within(details).getByText('hello@sunrise.test')).toBeInTheDocument();
    expect(within(details).getByText('+639171234567')).toBeInTheDocument();
    expect(within(details).getByText('Active')).toBeInTheDocument();
  });

  it('says "Not set" for a missing email or phone, and a suspended clinic in words', async () => {
    await open(MANAGER, {
      current: tenant({ contactEmail: null, contactPhone: null, status: 'suspended' }),
    });
    expect(screen.getAllByText('Not set')).toHaveLength(2);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('shows a person without tenant.settings.manage the details as text, no Edit, and the reason', async () => {
    await open(READER);
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    expect(
      screen.getByText("Only an owner or clinic admin can change the clinic's details."),
    ).toBeInTheDocument();
  });

  it('shows the problem, with its request id and a way to try again, when the clinic cannot be loaded', async () => {
    signIn(MANAGER);
    let failing = true;
    server.use(
      http.get(`${API}/tenant`, () =>
        failing ? errorBody(500, 'INTERNAL_ERROR') : HttpResponse.json({ data: tenant() }),
      ),
    );
    renderWithProviders(<ClinicProfilePage />, { controller: fakeController() });
    expect(await screen.findByText(/req-6/)).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Sunrise Clinic')).toBeInTheDocument();
  });

  it('has no accessibility violations, reading or editing', async () => {
    const { container } = await open(MANAGER);
    expect(await axe(container)).toHaveNoViolations();
    await startEditing();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ClinicProfilePage: editing', () => {
  it('sends only the field that changed', async () => {
    const { state } = await open(MANAGER);
    await startEditing();
    const name = screen.getByLabelText('Clinic name');
    await userEvent.clear(name);
    await userEvent.type(name, '  Sunrise Family Clinic ');
    await save();
    await waitFor(() => {
      expect(state.bodies).toEqual([{ name: 'Sunrise Family Clinic' }]);
    });
  });

  it('sends null for an emptied email or phone, and the phone without spaces or dashes', async () => {
    const { state } = await open(MANAGER);
    await startEditing();
    await userEvent.clear(screen.getByLabelText(/^Contact email/));
    await userEvent.clear(screen.getByLabelText(/^Contact phone/));
    await userEvent.type(screen.getByLabelText(/^Contact phone/), '+63 (918) 555-0100');
    await save();
    await waitFor(() => {
      expect(state.bodies).toEqual([{ contactEmail: null, contactPhone: '+639185550100' }]);
    });
  });

  it('sends nothing, and says so, when nothing changed', async () => {
    const { state } = await open(MANAGER);
    await startEditing();
    await save();
    expect(await screen.findByText('Nothing to change.')).toBeInTheDocument();
    expect(state.bodies).toEqual([]);
  });

  it.each([
    ['a blank name', 'Clinic name', '', 'Enter the clinic name.'],
    ['a name over 120 characters', 'Clinic name', 'x'.repeat(121), 'Use at most 120 characters.'],
    ['an email that is not one', /^Contact email/, 'not-an-email', 'Enter a valid email address.'],
    [
      'a phone with no country code',
      /^Contact phone/,
      '0917 123 4567',
      'Enter the phone number with its country code, for example +639171234567.',
    ],
  ])('refuses %s before sending anything', async (_label, field, typed, message) => {
    const { state } = await open(MANAGER);
    await startEditing();
    const input = screen.getByLabelText(field);
    await userEvent.clear(input);
    if (typed) await userEvent.type(input, typed);
    await save();
    expect((await screen.findAllByText(message)).length).toBeGreaterThan(0);
    expect(state.bodies).toEqual([]);
  });

  it('shows what the API answered, tells the person, and leaves editing', async () => {
    await open(MANAGER);
    await startEditing();
    const name = screen.getByLabelText('Clinic name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Sunrise Family Clinic');
    await save();
    expect(await screen.findByText('Clinic details saved.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Details' })).getByText('Sunrise Family Clinic'),
    ).toBeInTheDocument();
  });

  it('puts the API’s field problems under their fields and keeps what was typed', async () => {
    const { state } = await open(MANAGER, {
      reply: () =>
        errorBody(400, 'VALIDATION_FAILED', [
          { field: 'contactEmail', code: 'INVALID', message: 'bad email' },
        ]),
    });
    await startEditing();
    const email = screen.getByLabelText(/^Contact email/);
    await userEvent.clear(email);
    await userEvent.type(email, 'a@b.test');
    await save();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Contact email/)).toHaveValue('a@b.test');
    expect(state.bodies).toHaveLength(1);
  });

  it('leaves editing, with a message, when the server says the person may no longer change the clinic (FORBIDDEN)', async () => {
    await open(MANAGER, { reply: () => errorBody(403, 'FORBIDDEN') });
    await startEditing();
    const name = screen.getByLabelText('Clinic name');
    await userEvent.type(name, '!');
    await save();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('cancelling leaves editing without sending anything', async () => {
    const { state } = await open(MANAGER);
    await startEditing();
    await userEvent.type(screen.getByLabelText('Clinic name'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByText('Sunrise Clinic')).toBeInTheDocument();
    expect(state.bodies).toEqual([]);
  });
});

describe('ClinicProfilePage: changing the time zone', () => {
  async function chooseTokyo() {
    await startEditing();
    await userEvent.click(screen.getByRole('combobox', { name: 'Time zone' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Asia/Tokyo' }));
    await save();
  }

  it('asks first, says what happens to the dates, and focuses Cancel', async () => {
    const { state } = await open(MANAGER);
    await chooseTokyo();
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(/Dates and times for Sunrise Clinic will show in Asia\/Tokyo/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Saved times do not move/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Branches with their own time zone keep it/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(state.bodies).toEqual([]);
  });

  it('sends nothing when the person cancels, and keeps the form open', async () => {
    const { state } = await open(MANAGER);
    await chooseTokyo();
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(state.bodies).toEqual([]);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('after the API refuses the zone, the summary’s link moves focus to the picker', async () => {
    await open(MANAGER, {
      reply: () =>
        errorBody(400, 'VALIDATION_FAILED', [
          { field: 'timezone', code: 'INVALID_VALUE', message: 'x' },
        ]),
    });
    await chooseTokyo();
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Change time zone',
      }),
    );
    const summary = await screen.findByRole('alert');
    await userEvent.click(within(summary).getByRole('link', { name: 'Time zone' }));
    expect(screen.getByRole('combobox', { name: /Time zone/ })).toHaveFocus();
  });

  it('sends the new zone once confirmed, and shows it', async () => {
    const { state } = await open(MANAGER);
    await chooseTokyo();
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Change time zone',
      }),
    );
    await waitFor(() => {
      expect(state.bodies).toEqual([{ timezone: 'Asia/Tokyo' }]);
    });
    expect(await screen.findByText('Asia/Tokyo')).toBeInTheDocument();
  });
});

describe('ClinicProfilePage: what a save refreshes', () => {
  it('reads every clinic query again, so dates follow the new zone', async () => {
    const { state } = await open(MANAGER);
    await waitFor(() => {
      expect(state.memberGets).toBe(1);
    });
    await startEditing();
    await userEvent.type(screen.getByLabelText(/^Contact phone/), '0');
    await save();
    await waitFor(() => {
      expect(state.memberGets).toBe(2);
    });
  });

  it('reloads the session when the name changed, so the clinic switcher shows the new name', async () => {
    const { controller } = await open(MANAGER);
    await startEditing();
    await userEvent.type(screen.getByLabelText('Clinic name'), ' 2');
    await save();
    await waitFor(() => {
      expect(controller.refreshPermissions).toHaveBeenCalledTimes(1);
    });
  });

  it('does not reload the session when only the contact details changed', async () => {
    const { controller, state } = await open(MANAGER);
    await startEditing();
    await userEvent.type(screen.getByLabelText(/^Contact phone/), '0');
    await save();
    await waitFor(() => {
      expect(state.bodies).toHaveLength(1);
    });
    await act(() => Promise.resolve());
    expect(controller.refreshPermissions).not.toHaveBeenCalled();
  });
});
