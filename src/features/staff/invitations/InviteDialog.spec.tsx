import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { InviteDialog } from './InviteDialog.tsx';

const API = 'http://localhost:3000/api/v1';
const role = (key: string, name: string, assignable = true) => ({
  id: `id-${key}`,
  key,
  name,
  isSystem: true,
  permissions: [],
  assignable,
});
// An owner may give every role, including Owner: the invitation form must still leave Owner out.
const ROLES = [
  role('owner', 'Owner'),
  role('clinic_admin', 'Clinic admin'),
  role('doctor', 'Doctor'),
  role('receptionist', 'Receptionist'),
];
const errorBody = (status: number, code: string, details: unknown[] = []) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-8', details } },
    { status },
  );

beforeEach(() => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me Myself' },
    memberships: [],
    activeTenantId: 'clinic-a',
    permissions: ['members.read', 'members.invite'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
  server.use(http.get(`${API}/roles`, () => HttpResponse.json({ data: ROLES })));
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

function setup(reply?: () => Response) {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${API}/invitations`, async ({ request }) => {
      bodies.push(await request.json());
      return reply
        ? reply()
        : HttpResponse.json(
            {
              data: {
                id: 'i1',
                email: 'new@example.com',
                roleId: 'id-doctor',
                status: 'pending',
                expiresAt: '2026-12-01T00:00:00.000Z',
                createdAt: '2026-11-24T00:00:00.000Z',
              },
            },
            { status: 201 },
          );
    }),
  );
  const handlers = { onClose: vi.fn(), onInvited: vi.fn(), onShowOpen: vi.fn() };
  const view = renderWithProviders(<InviteDialog {...handlers} />);
  return { bodies, ...handlers, ...view };
}
const fill = async (email: string, roleName: string | undefined = 'Doctor') => {
  await userEvent.type(await screen.findByLabelText(/^Email/), email);
  if (roleName) await userEvent.click(await screen.findByRole('radio', { name: roleName }));
};
const send = () => userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

describe('InviteDialog', () => {
  it('offers every role except Owner, even to someone who may give Owner, and says where Owner comes from', async () => {
    setup();
    expect(await screen.findByRole('radio', { name: 'Doctor' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-labelledby') ?? ''),
    ).toHaveLength(3);
    expect(screen.queryByRole('radio', { name: 'Owner' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/The Owner role is given afterwards, from the person's page/),
    ).toBeInTheDocument();
  });

  it('does not offer a role the person may not give', async () => {
    server.use(
      http.get(`${API}/roles`, () =>
        HttpResponse.json({
          data: [role('clinic_admin', 'Clinic admin', false), role('doctor', 'Doctor')],
        }),
      ),
    );
    setup();
    await screen.findByRole('radio', { name: 'Doctor' });
    expect(screen.queryByRole('radio', { name: 'Clinic admin' })).not.toBeInTheDocument();
  });

  it('sends exactly the email (trimmed) and the role id', async () => {
    const { bodies, onInvited } = setup();
    await fill('  new@example.com ');
    await send();
    await waitFor(() => {
      expect(onInvited).toHaveBeenCalledWith('new@example.com');
    });
    expect(bodies).toEqual([{ email: 'new@example.com', roleId: 'id-doctor' }]);
  });

  it('refuses an empty email, a wrong one, one over 254 characters and no role, before sending', async () => {
    const { bodies } = setup();
    await screen.findByRole('radio', { name: 'Doctor' });
    await send();
    expect(await screen.findAllByText("Enter the person's email address.")).not.toHaveLength(0);
    expect(screen.getAllByText('Choose a role.')).not.toHaveLength(0);

    await userEvent.type(screen.getByLabelText(/^Email/), 'not-an-email');
    await send();
    expect(await screen.findAllByText('Enter a valid email address.')).not.toHaveLength(0);

    await userEvent.clear(screen.getByLabelText(/^Email/));
    await userEvent.click(screen.getByLabelText(/^Email/));
    await userEvent.paste(`${'a'.repeat(250)}@x.co`);
    await userEvent.click(screen.getByRole('radio', { name: 'Doctor' }));
    await send();
    expect(
      await screen.findAllByText('An email address can have at most 254 characters.'),
    ).not.toHaveLength(0);
    expect(bodies).toEqual([]);
  });

  it('puts "already on your staff" under the email (CONFLICT)', async () => {
    const { onInvited } = setup(() => errorBody(409, 'CONFLICT'));
    await fill('ana@example.com');
    await send();
    expect(await screen.findAllByText('This person is already on your staff.')).not.toHaveLength(0);
    expect(screen.getByLabelText(/^Email/)).toHaveValue('ana@example.com');
    expect(onInvited).not.toHaveBeenCalled();
  });

  it('says an invitation is already open (CONFLICT_UNIQUE) and offers to show the open ones', async () => {
    const { onShowOpen } = setup(() => errorBody(409, 'CONFLICT_UNIQUE'));
    await fill('ana@example.com');
    await send();
    expect(
      await screen.findAllByText('An invitation to this address is already open.'),
    ).not.toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Show open invitations' }));
    expect(onShowOpen).toHaveBeenCalled();
  });

  it('explains ROLE_NOT_ASSIGNABLE on the role', async () => {
    setup(() => errorBody(422, 'ROLE_NOT_ASSIGNABLE'));
    await fill('ana@example.com');
    await send();
    expect(
      (
        await screen.findAllByText(
          "The Owner role is given from the person's page, not by invitation.",
        )
      ).length,
    ).toBeGreaterThan(0);
  });

  it('says a role that has gone is no longer available (NOT_FOUND)', async () => {
    setup(() => errorBody(404, 'NOT_FOUND'));
    await fill('ana@example.com');
    await send();
    expect(
      (await screen.findAllByText('That role is no longer available. Choose another.')).length,
    ).toBeGreaterThan(0);
  });

  it('puts the API’s field problems under their fields and keeps what was typed', async () => {
    setup(() =>
      errorBody(400, 'VALIDATION_FAILED', [
        { field: 'email', code: 'INVALID_EMAIL', message: 'bad' },
      ]),
    );
    await fill('ana@example.com');
    await send();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toHaveValue('ana@example.com');
  });

  it('shows any other failure with its request id', async () => {
    setup(() => errorBody(500, 'INTERNAL'));
    await fill('ana@example.com');
    await send();
    expect(await screen.findByText(/req-8/)).toBeInTheDocument();
  });

  it('lets the person fix a refused role and send again', async () => {
    const { bodies } = setup();
    await screen.findByRole('radio', { name: 'Doctor' });
    await send();
    await screen.findAllByText('Choose a role.');
    await fill('new@example.com');
    await send();
    await waitFor(() => {
      expect(bodies).toEqual([{ email: 'new@example.com', roleId: 'id-doctor' }]);
    });
  });

  it('Cancel closes without sending anything', async () => {
    const { bodies, onClose } = setup();
    await screen.findByRole('radio', { name: 'Doctor' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(bodies).toEqual([]);
  });

  it('has no accessibility violations, plain and with errors', async () => {
    setup();
    await screen.findByRole('radio', { name: 'Doctor' });
    expect(await axe(document.body)).toHaveNoViolations();
    await send();
    await screen.findAllByText('Choose a role.');
    expect(await axe(document.body)).toHaveNoViolations();
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toBeInTheDocument();
  });
});
