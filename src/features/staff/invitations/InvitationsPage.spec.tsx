import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';
import { mockWideScreen } from '@/test/wide-screen.ts';

import { InvitationsPage, type InvitationsSearch } from './InvitationsPage.tsx';

const API = 'http://localhost:3000/api/v1';
const invitation = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  email: 'new.doctor@example.com',
  roleId: 'id-doctor',
  status: 'pending',
  expiresAt: '2026-03-08T20:00:00.000Z',
  createdAt: '2026-03-01T20:00:00.000Z',
  role: { id: 'id-doctor', key: 'doctor', name: 'Doctor' },
  invitedBy: { membershipId: 'm1', fullName: 'Olivia Owner' },
  acceptedAt: null,
  revokedAt: null,
  ...over,
});
const page = (data: unknown[], over: Record<string, number> = {}) => ({
  data,
  meta: {
    page: 1,
    pageSize: 20,
    totalItems: data.length,
    totalPages: data.length ? 1 : 0,
    ...over,
  },
});
const errorBody = (status: number, code: string) =>
  HttpResponse.json({ error: { status, code, message: 'x', requestId: 'req-3' } }, { status });
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

mockWideScreen();

function signIn(
  permissions = ['tenant.read', 'members.read', 'members.invite'],
  tenantId = 'clinic-a',
) {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me Myself' },
    memberships: [],
    activeTenantId: tenantId,
    permissions,
    platformRole: 'none',
    practitionerProfileId: null,
  });
}

function Harness({ initial = {} as InvitationsSearch }) {
  const [search, setSearch] = useState<InvitationsSearch>(initial);
  return (
    <>
      <InvitationsPage search={search} onSearchChange={setSearch} />
      <output data-testid="url-state">{JSON.stringify(search)}</output>
    </>
  );
}

/** A fake clinic: the list answers with `state.items` and counts how often it was asked. */
function serve(items: unknown[] = [invitation()]) {
  const state = {
    items,
    gets: 0,
    statuses: [] as (string | null)[],
    pages: [] as (string | null)[],
  };
  server.use(
    http.get(`${API}/invitations`, ({ request }) => {
      const url = new URL(request.url);
      state.gets += 1;
      state.statuses.push(url.searchParams.get('status'));
      state.pages.push(url.searchParams.get('page'));
      return HttpResponse.json(page(state.items));
    }),
    http.get(`${API}/tenant`, () => HttpResponse.json({ data: tenant })),
    http.get(`${API}/roles`, () =>
      HttpResponse.json({
        data: [
          {
            id: 'id-doctor',
            key: 'doctor',
            name: 'Doctor',
            isSystem: true,
            permissions: [],
            assignable: true,
          },
        ],
      }),
    ),
  );
  return state;
}

beforeEach(() => {
  signIn();
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('InvitationsPage: the list', () => {
  it('shows each invitation with its role, who sent it, status in words and dates in the clinic zone', async () => {
    serve([
      invitation(),
      invitation({
        id: 'i2',
        email: 'old@example.com',
        status: 'expired',
        invitedBy: { membershipId: 'm2', fullName: 'Ada Admin' },
      }),
      invitation({ id: 'i3', email: 'joined@example.com', status: 'accepted' }),
      invitation({ id: 'i4', email: 'gone@example.com', status: 'revoked' }),
    ]);
    renderWithProviders(<Harness />);
    expect(screen.getByRole('heading', { level: 1, name: 'Invitations' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Invitations' });
    const first = within(table).getByRole('row', { name: /new\.doctor@example\.com/ });
    expect(first).toHaveTextContent('Doctor');
    expect(first).toHaveTextContent('Olivia Owner');
    expect(first).toHaveTextContent('Pending');
    // 2026-03-01 20:00 UTC is 2 March in Manila; the runner is in New York.
    await waitFor(() => {
      expect(first).toHaveTextContent('Mar 2, 2026');
    });
    expect(first).toHaveTextContent('Mar 9, 2026');
    expect(within(table).getByRole('row', { name: /old@example\.com/ })).toHaveTextContent(
      'Expired',
    );
    expect(within(table).getByRole('row', { name: /old@example\.com/ })).toHaveTextContent(
      'Ada Admin',
    );
    expect(within(table).getByRole('row', { name: /joined@example\.com/ })).toHaveTextContent(
      'Accepted',
    );
    expect(within(table).getByRole('row', { name: /gone@example\.com/ })).toHaveTextContent(
      'Revoked',
    );
    expect(screen.getByText(/Dates are shown in Asia\/Manila/)).toBeInTheDocument();
  });

  it('asks for Pending first, and the filter has Pending, Accepted, Revoked and Expired', async () => {
    const state = serve();
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Invitations' });
    expect(state.statuses[0]).toBe('pending');
    const select = screen.getByRole('combobox', { name: 'Status' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Pending', 'Accepted', 'Revoked', 'Expired']);
    expect(select).toHaveValue('pending');
  });

  it('changing the filter asks for that status and keeps it in the address state; Pending keeps the address clean', async () => {
    const state = serve([]);
    renderWithProviders(<Harness />);
    await screen.findByText('No pending invitations');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Revoked');
    await waitFor(() => {
      expect(state.statuses).toContain('revoked');
    });
    expect(screen.getByTestId('url-state')).toHaveTextContent('"status":"revoked"');
    expect(await screen.findByText('No revoked invitations')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Pending');
    expect(screen.getByTestId('url-state')).toHaveTextContent('{}');
  });

  it('pages through the list', async () => {
    const state = serve();
    server.use(
      http.get(`${API}/invitations`, ({ request }) => {
        state.pages.push(new URL(request.url).searchParams.get('page'));
        return HttpResponse.json(page([invitation()], { totalItems: 45, totalPages: 3 }));
      }),
    );
    renderWithProviders(<Harness />);
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(state.pages).toContain('2');
    });
    expect(screen.getByTestId('url-state')).toHaveTextContent('"page":2');
  });

  it('shows a loading state, an empty state, and an error with its request id and Try again', async () => {
    let failing = true;
    server.use(
      http.get(`${API}/invitations`, () =>
        failing ? errorBody(500, 'INTERNAL') : HttpResponse.json(page([])),
      ),
      http.get(`${API}/tenant`, () => HttpResponse.json({ data: tenant })),
      http.get(`${API}/roles`, () => HttpResponse.json({ data: [] })),
    );
    renderWithProviders(<Harness />);
    expect(screen.getByText('Loading invitations…')).toBeInTheDocument();
    expect(await screen.findByText(/req-3/)).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No pending invitations')).toBeInTheDocument();
  });

  it('links to the Staff tab and marks Invitations as the current one', async () => {
    serve();
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Invitations' });
    const tabs = screen.getByRole('navigation', { name: 'Staff sections' });
    expect(within(tabs).getByRole('link', { name: 'Staff' })).toHaveAttribute('href', '/staff');
    expect(within(tabs).getByRole('link', { name: 'Invitations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('never shows one clinic’s invitations while another clinic loads', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API}/invitations`, async () => {
        const state = sessionStore.get();
        if (state.status === 'signed-in' && state.activeTenantId === 'clinic-b') {
          await gate;
          return HttpResponse.json(page([invitation({ id: 'ib', email: 'beth@b.example' })]));
        }
        return HttpResponse.json(page([invitation({ email: 'ana@a.example' })]));
      }),
      http.get(`${API}/tenant`, () => HttpResponse.json({ data: tenant })),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText('ana@a.example')).toBeInTheDocument();
    act(() => {
      signIn(undefined, 'clinic-b');
    });
    await waitFor(() => {
      expect(screen.queryByText('ana@a.example')).not.toBeInTheDocument();
    });
    release();
    expect(await screen.findByText('beth@b.example')).toBeInTheDocument();
  });
});

describe('InvitationsPage: buttons', () => {
  it('a pending and an expired invitation can be sent again or revoked; an accepted or revoked one has no buttons', async () => {
    serve([
      invitation({ email: 'p@example.com' }),
      invitation({ id: 'i2', email: 'e@example.com', status: 'expired' }),
      invitation({ id: 'i3', email: 'a@example.com', status: 'accepted' }),
      invitation({ id: 'i4', email: 'r@example.com', status: 'revoked' }),
    ]);
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Invitations' });
    for (const email of ['p@example.com', 'e@example.com']) {
      expect(
        screen.getByRole('button', { name: `Resend invitation to ${email}` }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: `Revoke invitation to ${email}` }),
      ).toBeInTheDocument();
    }
    for (const email of ['a@example.com', 'r@example.com']) {
      expect(screen.queryByRole('button', { name: new RegExp(email) })).not.toBeInTheDocument();
    }
  });

  it('without the right to invite: no Invite button, no row buttons, and the reason', async () => {
    signIn(['tenant.read', 'members.read']);
    serve();
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Invitations' });
    expect(screen.queryByRole('button', { name: 'Invite someone' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /invitation to/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('Only people who can invite staff can send, resend or revoke invitations.'),
    ).toBeInTheDocument();
  });

  it('with the right to invite, Invite someone is the primary action', async () => {
    serve();
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Invitations' });
    expect(screen.getByRole('button', { name: 'Invite someone' })).toBeInTheDocument();
  });
});

describe('InvitationsPage: resend and revoke', () => {
  it('Resend sends the request without asking and reads the list again', async () => {
    const state = serve();
    let posted = 0;
    server.use(
      http.post(`${API}/invitations/i1/resend`, () => {
        posted += 1;
        return HttpResponse.json({ data: invitation() });
      }),
    );
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Invitations' });
    const before = state.gets;
    await userEvent.click(screen.getByRole('button', { name: /Resend invitation to new\.doctor/ }));
    await waitFor(() => {
      expect(posted).toBe(1);
    });
    await waitFor(() => {
      expect(state.gets).toBeGreaterThan(before);
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('Revoke asks first, naming the person and what happens, with Cancel focused', async () => {
    const state = serve();
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Invitations' });
    await userEvent.click(screen.getByRole('button', { name: /Revoke invitation to new\.doctor/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Revoke the invitation to new.doctor@example.com?');
    expect(dialog).toHaveTextContent('The link in their email will stop working.');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    const before = state.gets;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(state.gets).toBe(before);
  });

  it('confirming Revoke sends the request and reads the list again', async () => {
    const state = serve();
    let posted = 0;
    server.use(
      http.post(`${API}/invitations/i1/revoke`, () => {
        posted += 1;
        state.items = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Invitations' });
    await userEvent.click(screen.getByRole('button', { name: /Revoke invitation to new\.doctor/ }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revoke' }),
    );
    expect(await screen.findByText('No pending invitations')).toBeInTheDocument();
    expect(posted).toBe(1);
  });

  it.each([
    ['resend', 'CONFLICT', 409],
    ['revoke', 'CONFLICT', 409],
  ])(
    '%s %s says the invitation was already dealt with and reads the list again',
    async (action, code, status) => {
      const state = serve();
      server.use(http.post(`${API}/invitations/i1/${action}`, () => errorBody(status, code)));
      renderWithProviders(<Harness />);
      await screen.findByRole('table', { name: 'Invitations' });
      const before = state.gets;
      await userEvent.click(
        screen.getByRole('button', {
          name: new RegExp(
            `${action === 'resend' ? 'Resend' : 'Revoke'} invitation to new\\.doctor`,
          ),
        }),
      );
      if (action === 'revoke') {
        await userEvent.click(
          within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revoke' }),
        );
      }
      expect(
        await screen.findByText('This invitation was already accepted or revoked.'),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(state.gets).toBeGreaterThan(before);
      });
    },
  );

  it('NOT_FOUND says the invitation is no longer in the clinic and reads the list again', async () => {
    const state = serve();
    server.use(http.post(`${API}/invitations/i1/resend`, () => errorBody(404, 'NOT_FOUND')));
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Invitations' });
    const before = state.gets;
    await userEvent.click(screen.getByRole('button', { name: /Resend invitation to new\.doctor/ }));
    expect(
      await screen.findByText('This invitation is no longer in your clinic.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(state.gets).toBeGreaterThan(before);
    });
  });

  it('any other failure shows its words with the request id', async () => {
    serve();
    server.use(http.post(`${API}/invitations/i1/resend`, () => errorBody(500, 'INTERNAL')));
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Invitations' });
    await userEvent.click(screen.getByRole('button', { name: /Resend invitation to new\.doctor/ }));
    expect(await screen.findByText(/req-3/)).toBeInTheDocument();
  });
});

describe('InvitationsPage: inviting', () => {
  it('after an invitation is sent the dialog closes and the Pending list is read again, even from another filter', async () => {
    const state = serve([]);
    server.use(
      http.post(`${API}/invitations`, () =>
        HttpResponse.json(
          {
            data: {
              id: 'i9',
              email: 'new@example.com',
              roleId: 'id-doctor',
              status: 'pending',
              expiresAt: '2026-12-01T00:00:00.000Z',
              createdAt: '2026-11-24T00:00:00.000Z',
            },
          },
          { status: 201 },
        ),
      ),
    );
    renderWithProviders(<Harness initial={{ status: 'revoked' }} />);
    await screen.findByText('No revoked invitations');
    await userEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    await userEvent.type(await screen.findByLabelText(/^Email/), 'new@example.com');
    await userEvent.click(await screen.findByRole('radio', { name: 'Doctor' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('url-state')).toHaveTextContent('{}');
    await waitFor(() => {
      expect(state.statuses.at(-1)).toBe('pending');
    });
  });

  it('"Show open invitations" in the dialog closes it and shows the Pending list', async () => {
    serve([]);
    server.use(http.post(`${API}/invitations`, () => errorBody(409, 'CONFLICT_UNIQUE')));
    renderWithProviders(<Harness initial={{ status: 'expired' }} />);
    await screen.findByText('No expired invitations');
    await userEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    await userEvent.type(await screen.findByLabelText(/^Email/), 'ana@example.com');
    await userEvent.click(await screen.findByRole('radio', { name: 'Doctor' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Show open invitations' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('url-state')).toHaveTextContent('{}');
  });
});

describe('InvitationsPage: accessibility', () => {
  it('has no violations, plain and with the invite dialog open', async () => {
    serve();
    const { container } = renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Invitations' });
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    await screen.findByRole('radio', { name: 'Doctor' });
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
