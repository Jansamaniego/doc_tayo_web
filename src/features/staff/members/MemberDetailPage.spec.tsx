import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { MemberDetailPage } from './MemberDetailPage.tsx';

const API = 'http://localhost:3000/api/v1';
const member = (over: Record<string, unknown> = {}) => ({
  membershipId: 'm1',
  userId: 'u1',
  email: 'ana@example.com',
  fullName: 'Ana Cruz',
  status: 'active',
  jobTitle: 'Head receptionist',
  roles: [
    { id: 'id-receptionist', key: 'receptionist', name: 'Receptionist' },
    { id: 'id-nurse', key: 'nurse', name: 'Nurse' },
  ],
  joinedAt: '2026-03-01T20:00:00.000Z',
  ...over,
});
const role = (key: string, name: string, assignable = true) => ({
  id: `id-${key}`,
  key,
  name,
  isSystem: true,
  permissions: [],
  assignable,
});
/** What the signed-in person may give: an owner may give Owner, a clinic admin may not. */
const rolesFor = (viewer: 'owner' | 'admin') => [
  role('owner', 'Owner', viewer === 'owner'),
  role('clinic_admin', 'Clinic admin'),
  role('nurse', 'Nurse'),
  role('receptionist', 'Receptionist'),
];
const tenant = {
  id: 'clinic-a',
  name: 'Sunrise Clinic',
  slug: 'sunrise',
  status: 'active',
  timezone: 'Asia/Manila',
  contactEmail: null,
  contactPhone: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const errorBody = (status: number, code: string) =>
  HttpResponse.json({ error: { status, code, message: 'x', requestId: 'req-4' } }, { status });

/** A tiny fake of the clinic: GETs answer with what `state.member` is now. */
function serve({
  viewer = 'admin',
  current = member(),
}: { viewer?: 'owner' | 'admin'; current?: Record<string, unknown> } = {}) {
  const state = { member: current, memberGets: 0, roleGets: 0, calls: [] as string[] };
  server.use(
    http.get(`${API}/members/m1`, () => {
      state.memberGets += 1;
      return HttpResponse.json({ data: state.member });
    }),
    http.get(`${API}/roles`, () => {
      state.roleGets += 1;
      return HttpResponse.json({ data: rolesFor(viewer) });
    }),
    http.get(`${API}/tenant`, () => HttpResponse.json({ data: tenant })),
  );
  return state;
}
const answerStatus = (path: 'suspend' | 'reactivate' | 'remove', reply: () => Response) => {
  server.use(http.post(`${API}/members/m1/${path}`, reply));
};

beforeEach(() => {
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
    permissions: ['tenant.read', 'members.read', 'members.manage'],
    platformRole: 'none',
  });
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

function renderDetail(onMissing = vi.fn()) {
  const view = renderWithProviders(<MemberDetailPage membershipId="m1" onMissing={onMissing} />);
  return { onMissing, ...view };
}
const heading = () => screen.findByRole('heading', { level: 1, name: 'Ana Cruz' });
const buttonNames = () => screen.queryAllByRole('button').map((button) => button.textContent);

describe('MemberDetailPage: what it shows', () => {
  it('shows the person: name, email, status, roles, job title and the joined date in the clinic zone', async () => {
    serve();
    renderDetail();
    await heading();
    const page = document.body;
    expect(page).toHaveTextContent('ana@example.com');
    expect(page).toHaveTextContent('Active');
    expect(page).toHaveTextContent('Receptionist, Nurse');
    expect(page).toHaveTextContent('Head receptionist');
    // 2026-03-01 20:00 UTC is 2 March in Manila; the runner is in New York.
    await waitFor(() => {
      expect(page).toHaveTextContent('Mar 2, 2026');
    });
    expect(screen.getByRole('link', { name: 'All staff' })).toHaveAttribute('href', '/staff');
  });

  it('says so when there is no job title or joined date', async () => {
    serve({ current: member({ jobTitle: null, joinedAt: null, status: 'suspended' }) });
    renderDetail();
    await heading();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
    expect(screen.getAllByText('Not set').length).toBeGreaterThanOrEqual(1);
  });

  it('goes back to the list when the person is not on this clinic’s staff', async () => {
    server.use(
      http.get(`${API}/members/m1`, () => errorBody(404, 'NOT_FOUND')),
      http.get(`${API}/roles`, () => HttpResponse.json({ data: rolesFor('admin') })),
      http.get(`${API}/tenant`, () => HttpResponse.json({ data: tenant })),
    );
    const { onMissing } = renderDetail();
    await waitFor(() => {
      expect(onMissing).toHaveBeenCalled();
    });
  });

  it('shows another error with its request id and tries again', async () => {
    server.use(
      http.get(`${API}/members/m1`, () => errorBody(500, 'INTERNAL')),
      http.get(`${API}/roles`, () => HttpResponse.json({ data: rolesFor('admin') })),
      http.get(`${API}/tenant`, () => HttpResponse.json({ data: tenant })),
    );
    renderDetail();
    expect(await screen.findByText(/req-4/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('MemberDetailPage: which buttons are offered', () => {
  it('an active member: Edit, Suspend and Remove', async () => {
    serve();
    renderDetail();
    await heading();
    expect(buttonNames()).toEqual(['Edit', 'Suspend', 'Remove']);
  });

  it('a suspended member: Edit, Reactivate and Remove', async () => {
    serve({ current: member({ status: 'suspended' }) });
    renderDetail();
    await heading();
    expect(buttonNames().sort()).toEqual(['Edit', 'Reactivate', 'Remove']);
  });

  it('your own row: only Edit job title, and who must do the rest', async () => {
    serve({ current: member({ userId: 'me' }) });
    renderDetail();
    await heading();
    expect(buttonNames()).toEqual(['Edit job title']);
    expect(screen.getByText('Another admin must change your roles or status.')).toBeInTheDocument();
  });

  it('an owner, seen by a clinic admin: only Edit job title, and why', async () => {
    serve({
      viewer: 'admin',
      current: member({ roles: [{ id: 'id-owner', key: 'owner', name: 'Owner' }] }),
    });
    renderDetail();
    await heading();
    expect(buttonNames()).toEqual(['Edit job title']);
    expect(
      screen.getByText("Only an owner can change an owner's roles or status."),
    ).toBeInTheDocument();
  });

  it('an owner, seen by another owner: the full set', async () => {
    serve({
      viewer: 'owner',
      current: member({ roles: [{ id: 'id-owner', key: 'owner', name: 'Owner' }] }),
    });
    renderDetail();
    await heading();
    expect(buttonNames()).toEqual(['Edit', 'Suspend', 'Remove']);
  });

  it('a removed member: nothing, and how to bring them back', async () => {
    serve({ current: member({ status: 'removed' }) });
    renderDetail();
    await heading();
    expect(buttonNames()).toEqual([]);
    expect(screen.getByText('To bring them back, invite them again.')).toBeInTheDocument();
  });

  it('without the right to manage staff: no buttons, and the reason', async () => {
    sessionStore.set({
      ...(sessionStore.get() as Extract<
        ReturnType<typeof sessionStore.get>,
        { status: 'signed-in' }
      >),
      permissions: ['tenant.read', 'members.read'],
    });
    serve();
    renderDetail();
    await heading();
    expect(buttonNames()).toEqual([]);
    expect(screen.getByText('Only people who manage staff can change this.')).toBeInTheDocument();
  });
});

describe('MemberDetailPage: suspend, reactivate and remove', () => {
  it('Suspend asks first, naming the person, the clinic and what happens, with Cancel focused', async () => {
    const state = serve();
    renderDetail();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Suspend Ana Cruz?');
    expect(dialog).toHaveTextContent(
      'Ana Cruz will lose access to Sunrise Clinic on their next request.',
    );
    expect(dialog).toHaveTextContent('You can reactivate them');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(state.calls).toEqual([]);
  });

  it('confirming Suspend sends the request, reloads the person and the list, and confirms', async () => {
    const state = serve();
    let posted = 0;
    answerStatus('suspend', () => {
      posted += 1;
      state.member = member({ status: 'suspended' });
      return new HttpResponse(null, { status: 204 });
    });
    renderDetail();
    await heading();
    const before = state.memberGets;
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Suspend' }),
    );
    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    expect(posted).toBe(1);
    expect(state.memberGets).toBeGreaterThan(before);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('Remove says it cannot be undone here and that the person can be invited again', async () => {
    serve();
    renderDetail();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Remove Ana Cruz from Sunrise Clinic?');
    expect(dialog).toHaveTextContent('You cannot undo this here');
    expect(dialog).toHaveTextContent('invite them again');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('confirming Remove leaves the person with no actions', async () => {
    const state = serve();
    answerStatus('remove', () => {
      state.member = member({ status: 'removed' });
      return new HttpResponse(null, { status: 204 });
    });
    renderDetail();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove' }),
    );
    expect(await screen.findByText('To bring them back, invite them again.')).toBeInTheDocument();
    expect(buttonNames()).toEqual([]);
  });

  it('Reactivate asks first and then brings the person back', async () => {
    const state = serve({ current: member({ status: 'suspended' }) });
    answerStatus('reactivate', () => {
      state.member = member({ status: 'active' });
      return new HttpResponse(null, { status: 204 });
    });
    renderDetail();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Reactivate Ana Cruz?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reactivate' }));
    expect(await screen.findByRole('button', { name: 'Suspend' })).toBeInTheDocument();
  });
});

describe('MemberDetailPage: when the server says no', () => {
  const trySuspend = async () => {
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Suspend' }),
    );
  };

  it.each([
    [
      403,
      'SELF_ACTION_FORBIDDEN',
      'You cannot change your own roles or status. Another admin must do it.',
    ],
    [403, 'OWNER_REQUIRED', "Only an owner can change the Owner role or an owner's status."],
    [409, 'LAST_OWNER', 'The clinic must keep at least one active owner.'],
    [
      409,
      'CONFLICT',
      'This person was changed by someone else. Check their details and try again.',
    ],
  ])('%s %s shows its words on the page and reads the person again', async (status, code, text) => {
    const state = serve();
    answerStatus('suspend', () => errorBody(status, code));
    renderDetail();
    const before = () => state.memberGets;
    await heading();
    const gets = before();
    await trySuspend();
    expect(await screen.findByText(text)).toBeInTheDocument();
    await waitFor(() => {
      expect(state.memberGets).toBeGreaterThan(gets);
    });
  });

  it('OWNER_REQUIRED also reads the roles again, since what the person may give has changed', async () => {
    const state = serve();
    answerStatus('suspend', () => errorBody(403, 'OWNER_REQUIRED'));
    renderDetail();
    await heading();
    const gets = state.roleGets;
    await trySuspend();
    await waitFor(() => {
      expect(state.roleGets).toBeGreaterThan(gets);
    });
  });

  it('NOT_FOUND goes back to the list', async () => {
    serve();
    answerStatus('suspend', () => errorBody(404, 'NOT_FOUND'));
    const { onMissing } = renderDetail();
    await trySuspend();
    await waitFor(() => {
      expect(onMissing).toHaveBeenCalled();
    });
  });

  it('any other failure shows its words with the request id, and the page stays', async () => {
    serve();
    answerStatus('suspend', () => errorBody(500, 'INTERNAL'));
    renderDetail();
    await trySuspend();
    expect(await screen.findByText(/req-4/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeInTheDocument();
  });
});

describe('MemberDetailPage: editing', () => {
  it('Edit opens the form, and saving shows the returned person with a confirmation', async () => {
    const state = serve();
    server.use(
      http.patch(`${API}/members/m1`, () => {
        state.member = member({ jobTitle: 'Charge nurse' });
        return HttpResponse.json({ data: state.member });
      }),
    );
    renderDetail();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText(/^Job title/)).toHaveValue('Head receptionist');
    await userEvent.clear(screen.getByLabelText(/^Job title/));
    await userEvent.type(screen.getByLabelText(/^Job title/), 'Charge nurse');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Charge nurse')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Job title/)).not.toBeInTheDocument();
  });

  it('Cancel closes the form without changing anything', async () => {
    serve();
    renderDetail();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText(/^Job title/)).not.toBeInTheDocument();
    expect(screen.getByText('Head receptionist')).toBeInTheDocument();
  });

  it('a clinic admin editing an owner sees the job title field only', async () => {
    serve({
      viewer: 'admin',
      current: member({ roles: [{ id: 'id-owner', key: 'owner', name: 'Owner' }] }),
    });
    renderDetail();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Edit job title' }));
    expect(screen.getByLabelText(/^Job title/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Roles' })).not.toBeInTheDocument();
  });

  it('shows what the server said when saving fails (someone else changed the person first)', async () => {
    serve();
    server.use(http.patch(`${API}/members/m1`, () => errorBody(409, 'CONFLICT')));
    renderDetail();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.type(screen.getByLabelText(/^Job title/), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        'This person was changed by someone else. Check their details and try again.',
      ),
    ).toBeInTheDocument();
  });
});

describe('MemberDetailPage: accessibility', () => {
  it('has no violations, plain, with the edit form, and with the dialog open', async () => {
    serve();
    const { container } = renderDetail();
    await heading();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    await screen.findByRole('alertdialog');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
