import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { notify, ToastRegion } from '@/design-system/components/toast.tsx';
import { useBranches } from '@/features/clinic/api/branches.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { BranchPage } from './BranchPage.tsx';

const API = 'http://localhost:3000/api/v1';
const branch = (over: Record<string, unknown> = {}) => ({
  id: 'b1',
  name: 'Main',
  addressLine: '1 Rizal Ave',
  city: 'Quezon City',
  province: 'Metro Manila',
  timezone: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});
const errorBody = (status: number, code: string, details: unknown[] = []) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-9', details } },
    { status },
  );

const MANAGER = ['tenant.read', 'branches.read', 'branches.manage'];
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

/** The branch as the API serves it; a PATCH merges its body in, like the real one. */
function serve({
  current = branch(),
  reply,
  missing = false,
}: { current?: Record<string, unknown>; reply?: () => Response; missing?: boolean } = {}) {
  const state = { branch: current, bodies: [] as unknown[], listGets: 0 };
  server.use(
    http.get(`${API}/branches/b1`, () =>
      missing ? errorBody(404, 'NOT_FOUND') : HttpResponse.json({ data: state.branch }),
    ),
    http.patch(`${API}/branches/b1`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      state.bodies.push(body);
      if (reply) return reply();
      state.branch = { ...state.branch, ...body };
      return HttpResponse.json({ data: state.branch });
    }),
    http.get(`${API}/branches`, () => {
      state.listGets += 1;
      return HttpResponse.json({
        data: [],
        meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      });
    }),
    http.get(`${API}/tenant`, () =>
      HttpResponse.json({
        data: {
          id: 'clinic-a',
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
  return state;
}

/** Stands in for any screen that lists branches (the branch list, a branch selector). */
function BranchListScreen() {
  useBranches({});
  return null;
}

async function open(
  permissions: string[],
  options: Parameters<typeof serve>[0] = {},
  heading = 'Main',
) {
  signIn(permissions);
  const state = serve(options);
  const onMissing = vi.fn();
  const view = renderWithProviders(
    <>
      <BranchPage branchId="b1" onMissing={onMissing} />
      <BranchListScreen />
      <ToastRegion />
    </>,
  );
  await screen.findByRole('heading', { level: 1, name: heading });
  return { state, onMissing, ...view };
}
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save' }));

describe('BranchPage: reading', () => {
  it('shows the branch in words, with "Clinic’s (zone)" for a branch with no zone of its own', async () => {
    await open(MANAGER);
    const details = screen.getByRole('region', { name: 'Details' });
    expect(within(details).getByText('1 Rizal Ave')).toBeInTheDocument();
    expect(within(details).getByText('Quezon City')).toBeInTheDocument();
    expect(within(details).getByText('Metro Manila')).toBeInTheDocument();
    expect(within(details).getByText("Clinic's (Asia/Manila)")).toBeInTheDocument();
    expect(within(details).getByText('Active')).toBeInTheDocument();
  });

  it('shows read-only, with the reason, to a person who may not manage branches', async () => {
    await open(READER);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Only an owner or clinic admin can change branches.'),
    ).toBeInTheDocument();
  });

  it('goes back to the list when the branch is not in this clinic (404)', async () => {
    signIn(MANAGER);
    serve({ missing: true });
    const onMissing = vi.fn();
    renderWithProviders(<BranchPage branchId="b1" onMissing={onMissing} />);
    await waitFor(() => {
      expect(onMissing).toHaveBeenCalled();
    });
  });

  it('has no accessibility violations, reading or editing', async () => {
    const { container } = await open(MANAGER);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('BranchPage: editing', () => {
  it('sends only what changed, and tells the person', async () => {
    const { state } = await open(MANAGER);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const city = screen.getByLabelText(/^City/);
    await userEvent.clear(city);
    await userEvent.type(city, 'Pasig');
    await save();
    await waitFor(() => {
      expect(state.bodies).toEqual([{ city: 'Pasig' }]);
    });
    expect(await screen.findByText('Branch details saved.')).toBeInTheDocument();
    expect(await screen.findByText('Pasig')).toBeInTheDocument();
  });

  it('sends null for an emptied optional field', async () => {
    const { state } = await open(MANAGER, { current: branch({ timezone: 'Asia/Tokyo' }) });
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByLabelText(/^Address/));
    await save();
    await waitFor(() => {
      expect(state.bodies).toEqual([{ addressLine: null }]);
    });
  });

  it('sends null to go back to the clinic’s time zone', async () => {
    const { state } = await open(MANAGER, { current: branch({ timezone: 'Asia/Tokyo' }) });
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('combobox', { name: /^Time zone/ }));
    await userEvent.click(await screen.findByRole('option', { name: /Clinic's time zone/ }));
    await save();
    await waitFor(() => {
      expect(state.bodies).toEqual([{ timezone: null }]);
    });
  });

  it('sends nothing, and says so, when nothing changed', async () => {
    const { state } = await open(MANAGER);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await save();
    expect(await screen.findByText('Nothing to change.')).toBeInTheDocument();
    expect(state.bodies).toEqual([]);
  });

  it('refuses a blank name before sending', async () => {
    const { state } = await open(MANAGER);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByLabelText('Branch name'));
    await save();
    expect((await screen.findAllByText('Enter the branch name.')).length).toBeGreaterThan(0);
    expect(state.bodies).toEqual([]);
  });

  it('says the clinic already has a branch with that name, on the name field', async () => {
    await open(MANAGER, { reply: () => errorBody(409, 'CONFLICT_UNIQUE') });
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const name = screen.getByLabelText('Branch name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Annex');
    await save();
    expect(
      (await screen.findAllByText('Your clinic already has a branch with this name.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText('Branch name')).toHaveValue('Annex');
  });

  it('reads the branch list again after a change', async () => {
    const { state } = await open(MANAGER);
    await waitFor(() => {
      expect(state.listGets).toBe(1);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.type(screen.getByLabelText(/^City/), '!');
    await save();
    await waitFor(() => {
      expect(state.listGets).toBe(2);
    });
  });
});

describe('BranchPage: deactivating and reactivating', () => {
  it('asks first, names the branch and what happens, and focuses Cancel', async () => {
    const { state } = await open(MANAGER);
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(
        /Main will no longer be offered when staff choose a branch\. Its records stay, and you can reactivate it\./,
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(state.bodies).toEqual([]);
  });

  it('sends nothing when the person cancels', async () => {
    const { state } = await open(MANAGER);
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(state.bodies).toEqual([]);
  });

  it('deactivates once confirmed, tells the person, and offers Reactivate', async () => {
    const { state } = await open(MANAGER);
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate' }),
    );
    await waitFor(() => {
      expect(state.bodies).toEqual([{ isActive: false }]);
    });
    expect(await screen.findByText('Main was deactivated.')).toBeInTheDocument();
    expect(await screen.findByText('Inactive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  });

  it('reactivates at once, with no question', async () => {
    const { state } = await open(MANAGER, { current: branch({ isActive: false }) });
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate' }));
    await waitFor(() => {
      expect(state.bodies).toEqual([{ isActive: true }]);
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Main is active again.')).toBeInTheDocument();
  });
});
