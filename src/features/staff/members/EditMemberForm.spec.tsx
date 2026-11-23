import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import type { Member } from '../api/members.ts';
import type { Role } from '../api/roles.ts';
import { EditMemberForm } from './EditMemberForm.tsx';

const API = 'http://localhost:3000/api/v1';
const role = (key: string, name: string, over: Partial<Role> = {}): Role => ({
  id: `id-${key}`,
  key,
  name,
  isSystem: true,
  permissions: [],
  assignable: true,
  ...over,
});
const ROLES: Role[] = [
  role('owner', 'Owner', { assignable: false }),
  role('clinic_admin', 'Clinic admin'),
  role('doctor', 'Doctor'),
  role('nurse', 'Nurse'),
  role('receptionist', 'Receptionist'),
  role('billing', 'Billing', { isSystem: false }),
  role('lab', 'Lab', { isSystem: false }),
];
const member = (over: Partial<Member> = {}): Member => ({
  membershipId: 'm1',
  userId: 'u1',
  email: 'ana@example.com',
  fullName: 'Ana Cruz',
  status: 'active',
  jobTitle: 'Head nurse',
  roles: [{ id: 'id-nurse', key: 'nurse', name: 'Nurse' }],
  joinedAt: null,
  ...over,
});
const errorBody = (status: number, code: string, details: unknown[] = []) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-5', details } },
    { status },
  );

beforeEach(() => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me Myself' },
    memberships: [],
    activeTenantId: 'clinic-a',
    permissions: ['members.read', 'members.manage'],
    platformRole: 'none',
  });
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

function setup({
  canEditRoles = true,
  current = member(),
  reply,
}: {
  canEditRoles?: boolean;
  current?: Member;
  reply?: () => Response;
} = {}) {
  const bodies: unknown[] = [];
  server.use(
    http.patch(`${API}/members/m1`, async ({ request }) => {
      bodies.push(await request.json());
      return reply ? reply() : HttpResponse.json({ data: { ...current, jobTitle: 'Saved' } });
    }),
  );
  const handlers = { onSaved: vi.fn(), onFailed: vi.fn(), onCancel: vi.fn() };
  const view = renderWithProviders(
    <EditMemberForm member={current} roles={ROLES} canEditRoles={canEditRoles} {...handlers} />,
  );
  return { bodies, ...handlers, ...view };
}

const roleBox = (name: string) => screen.getByRole('checkbox', { name });

describe('EditMemberForm', () => {
  it('shows the current roles checked and the job title filled in', () => {
    setup();
    expect(roleBox('Nurse')).toBeChecked();
    expect(roleBox('Doctor')).not.toBeChecked();
    expect(screen.getByLabelText(/^Job title/)).toHaveValue('Head nurse');
  });

  it('sends only the job title when only the job title changed', async () => {
    const { bodies, onSaved } = setup();
    await userEvent.clear(screen.getByLabelText(/^Job title/));
    await userEvent.type(screen.getByLabelText(/^Job title/), '  Charge nurse ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(bodies).toEqual([{ jobTitle: 'Charge nurse' }]);
  });

  it('sends only the roles when only the roles changed: the whole new set', async () => {
    const { bodies } = setup();
    await userEvent.click(roleBox('Doctor'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(bodies).toEqual([{ roleIds: ['id-nurse', 'id-doctor'] }]);
    });
  });

  it('sends both when both changed', async () => {
    const { bodies } = setup();
    await userEvent.click(roleBox('Doctor'));
    await userEvent.type(screen.getByLabelText(/^Job title/), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(bodies).toEqual([{ roleIds: ['id-nurse', 'id-doctor'], jobTitle: 'Head nurse!' }]);
    });
  });

  it('sends null when the job title is emptied', async () => {
    const { bodies } = setup();
    await userEvent.clear(screen.getByLabelText(/^Job title/));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(bodies).toEqual([{ jobTitle: null }]);
    });
  });

  it('sends nothing when nothing changed, and says so', async () => {
    const { bodies, onSaved } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Nothing to change.')).toBeInTheDocument();
    expect(bodies).toEqual([]);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('does not treat an empty job title that was already empty as a change', async () => {
    const { bodies } = setup({ current: member({ jobTitle: null }) });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Nothing to change.')).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('refuses no roles at all, before sending', async () => {
    const { bodies } = setup();
    await userEvent.click(roleBox('Nurse'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findAllByText('Choose at least one role.')).not.toHaveLength(0);
    expect(bodies).toEqual([]);
  });

  it('lets the person fix "no roles" and save: choosing a role clears the error', async () => {
    const { bodies } = setup();
    await userEvent.click(roleBox('Nurse'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findAllByText('Choose at least one role.');
    await userEvent.click(roleBox('Doctor'));
    expect(screen.queryByText('Choose at least one role.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(bodies).toEqual([{ roleIds: ['id-doctor'] }]);
    });
  });

  it('refuses six roles, before sending', async () => {
    const { bodies } = setup();
    for (const name of ['Clinic admin', 'Doctor', 'Receptionist', 'Billing', 'Lab']) {
      await userEvent.click(roleBox(name));
    }
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findAllByText('Choose at most 5 roles.')).not.toHaveLength(0);
    expect(bodies).toEqual([]);
  });

  it('refuses a job title longer than 100 characters, before sending', async () => {
    const { bodies } = setup();
    await userEvent.clear(screen.getByLabelText(/^Job title/));
    await userEvent.click(screen.getByLabelText(/^Job title/));
    await userEvent.paste('x'.repeat(101));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findAllByText('A job title can have at most 100 characters.'),
    ).not.toHaveLength(0);
    expect(bodies).toEqual([]);
  });

  it('lets the person shorten a too-long job title and save', async () => {
    const { bodies } = setup();
    await userEvent.clear(screen.getByLabelText(/^Job title/));
    await userEvent.click(screen.getByLabelText(/^Job title/));
    await userEvent.paste('x'.repeat(101));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findAllByText('A job title can have at most 100 characters.');
    await userEvent.clear(screen.getByLabelText(/^Job title/));
    await userEvent.type(screen.getByLabelText(/^Job title/), 'Short');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(bodies).toEqual([{ jobTitle: 'Short' }]);
    });
  });

  it('explains a role the person may not give, instead of showing a bare disabled box', () => {
    setup();
    expect(screen.queryByRole('checkbox', { name: 'Owner' })).not.toBeInTheDocument();
    expect(screen.getByText(/Only an owner can give the Owner role/)).toBeInTheDocument();
  });

  it('offers the Owner role to an owner, with how to hand the clinic over', () => {
    server.use();
    renderWithProviders(
      <EditMemberForm
        member={member()}
        roles={ROLES.map((r) => (r.key === 'owner' ? { ...r, assignable: true } : r))}
        canEditRoles
        onSaved={vi.fn()}
        onFailed={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(roleBox('Owner')).not.toBeChecked();
    expect(
      screen.getByText(/To hand over the clinic, give another member the Owner role/),
    ).toBeInTheDocument();
  });

  it('with no right to change roles, shows only the job title', async () => {
    const { bodies } = setup({ canEditRoles: false });
    expect(screen.queryByRole('group', { name: 'Roles' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Job title/), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(bodies).toEqual([{ jobTitle: 'Head nurse!' }]);
    });
  });

  it('puts the API’s field problems under their fields and keeps what was typed', async () => {
    const { onFailed } = setup({
      reply: () =>
        errorBody(400, 'VALIDATION_FAILED', [
          { field: 'jobTitle', code: 'TOO_LONG', message: 'too long' },
        ]),
    });
    await userEvent.type(screen.getByLabelText(/^Job title/), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Job title/)).toHaveValue('Head nurse!');
    expect(onFailed).not.toHaveBeenCalled();
  });

  it.each(['OWNER_REQUIRED', 'CONFLICT', 'NOT_FOUND', 'LAST_OWNER'])(
    'hands %s to the page and stays open with the input kept',
    async (code) => {
      const status = code === 'NOT_FOUND' ? 404 : code === 'OWNER_REQUIRED' ? 403 : 409;
      const { onFailed } = setup({ reply: () => errorBody(status, code) });
      await userEvent.type(screen.getByLabelText(/^Job title/), '!');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(onFailed).toHaveBeenCalledWith(expect.objectContaining({ code }));
      });
      expect(screen.getByLabelText(/^Job title/)).toHaveValue('Head nurse!');
    },
  );

  it('Cancel closes without asking the server', async () => {
    const { bodies, onCancel } = setup();
    await userEvent.type(screen.getByLabelText(/^Job title/), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(bodies).toEqual([]);
  });

  it('has no accessibility violations, plain and with errors', async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(roleBox('Nurse'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findAllByText('Choose at least one role.');
    expect(await axe(container)).toHaveNoViolations();
    expect(within(container).getByRole('alert')).toBeInTheDocument();
  });
});
