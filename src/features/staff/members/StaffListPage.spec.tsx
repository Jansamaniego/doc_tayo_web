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

import { StaffListPage, type StaffSearch } from './StaffListPage.tsx';

const API = 'http://localhost:3000/api/v1';
const member = (over: Record<string, unknown> = {}) => ({
  membershipId: 'm1',
  userId: 'u1',
  email: 'ana@example.com',
  fullName: 'Ana Cruz',
  status: 'active',
  jobTitle: 'Receptionist',
  roles: [{ id: 'r1', key: 'receptionist', name: 'Receptionist' }],
  joinedAt: '2026-03-01T20:00:00.000Z',
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
  HttpResponse.json({ error: { status, code, message: 'x', requestId: 'req-9' } }, { status });

mockWideScreen();

function signIn(tenantId = 'clinic-a', userId = 'me') {
  sessionStore.set({
    status: 'signed-in',
    user: { id: userId, email: 'me@example.com', fullName: 'Me Myself' },
    memberships: [],
    activeTenantId: tenantId,
    permissions: ['tenant.read', 'members.read'],
    platformRole: 'none',
  });
}

/** The clinic's time zone comes from GET /tenant. */
function serveTenant(timezone = 'Asia/Manila'): void {
  server.use(
    http.get(`${API}/tenant`, () =>
      HttpResponse.json({
        data: {
          id: 'clinic-a',
          name: 'Sunrise Clinic',
          slug: 'sunrise',
          status: 'active',
          timezone,
          contactEmail: null,
          contactPhone: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    ),
  );
}

function Harness({ initial = {} as StaffSearch }) {
  const [search, setSearch] = useState<StaffSearch>(initial);
  return (
    <>
      <StaffListPage search={search} onSearchChange={setSearch} />
      <output data-testid="url-state">{JSON.stringify(search)}</output>
    </>
  );
}

beforeEach(() => {
  signIn();
  serveTenant();
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('StaffListPage', () => {
  it('lists staff with roles, job title, status in words and the joined date in the clinic zone', async () => {
    server.use(
      http.get(`${API}/members`, () =>
        HttpResponse.json(
          page([
            member(),
            member({
              membershipId: 'm2',
              userId: 'u2',
              email: 'ben@example.com',
              fullName: 'Ben Reyes',
              status: 'suspended',
              jobTitle: null,
              roles: [
                { id: 'r2', key: 'doctor', name: 'Doctor' },
                { id: 'r3', key: 'nurse', name: 'Nurse' },
              ],
              joinedAt: null,
            }),
            member({
              membershipId: 'm3',
              userId: 'u3',
              email: 'gone@example.com',
              fullName: 'Gone Person',
              status: 'removed',
            }),
          ]),
        ),
      ),
    );
    renderWithProviders(<Harness />);
    expect(screen.getByRole('heading', { level: 1, name: 'Staff' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Staff' });
    const ana = within(table).getByRole('row', { name: /Ana Cruz/ });
    expect(ana).toHaveTextContent('ana@example.com');
    expect(ana).toHaveTextContent('Receptionist');
    expect(ana).toHaveTextContent('Active');
    // 2026-03-01 20:00 UTC is already 2 March in Manila (the runner is in New York).
    await waitFor(() => {
      expect(ana).toHaveTextContent('Mar 2, 2026');
    });
    const ben = within(table).getByRole('row', { name: /Ben Reyes/ });
    expect(ben).toHaveTextContent('Doctor, Nurse');
    expect(ben).toHaveTextContent('Suspended');
    expect(within(table).getByRole('row', { name: /Gone Person/ })).toHaveTextContent('Removed');
    expect(screen.getByText(/Dates are shown in Asia\/Manila/)).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Ana Cruz' })).toHaveAttribute(
      'href',
      '/staff/m1',
    );
  });

  it('marks the signed-in person’s own row "(you)" and no other', async () => {
    signIn('clinic-a', 'u2');
    server.use(
      http.get(`${API}/members`, () =>
        HttpResponse.json(
          page([member(), member({ membershipId: 'm2', userId: 'u2', fullName: 'Ben Reyes' })]),
        ),
      ),
    );
    renderWithProviders(<Harness />);
    const table = await screen.findByRole('table', { name: 'Staff' });
    expect(within(table).getByRole('row', { name: /Ben Reyes/ })).toHaveTextContent('(you)');
    expect(within(table).getByRole('row', { name: /Ana Cruz/ })).not.toHaveTextContent('(you)');
  });

  it('asks for the first page of 20 with no status (everyone except removed)', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(`${API}/members`, ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json(page([member()]));
      }),
    );
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Staff' });
    expect(urls[0]?.searchParams.has('status')).toBe(false);
    expect(urls[0]?.searchParams.has('q')).toBe(false);
    expect(urls[0]?.searchParams.get('pageSize')).toBeNull();
  });

  it('offers Active, Suspended and Removed as filters, never Invited, and keeps the filter in the address state', async () => {
    const statuses: (string | null)[] = [];
    server.use(
      http.get(`${API}/members`, ({ request }) => {
        statuses.push(new URL(request.url).searchParams.get('status'));
        return HttpResponse.json(page([member({ status: 'suspended' })]));
      }),
    );
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Staff' });
    const select = screen.getByRole('combobox', { name: 'Status' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All', 'Active', 'Suspended', 'Removed']);
    await userEvent.selectOptions(select, 'Suspended');
    await waitFor(() => {
      expect(statuses).toContain('suspended');
    });
    expect(screen.getByTestId('url-state')).toHaveTextContent('"status":"suspended"');
  });

  it('searches by name or email, keeps the text out of the address state and goes back to page 1', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(`${API}/members`, ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json(page([member()], { page: 2, totalItems: 45, totalPages: 3 }));
      }),
    );
    renderWithProviders(<Harness initial={{ page: 2, status: 'active' }} />);
    await screen.findByRole('table', { name: 'Staff' });
    expect(urls[0]?.searchParams.get('page')).toBe('2');
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search staff' }),
      '  ana@  {Enter}',
    );
    await waitFor(() => {
      expect(urls.some((url) => url.searchParams.get('q') === 'ana@')).toBe(true);
    });
    const searched = urls.find((url) => url.searchParams.get('q') === 'ana@');
    expect(searched?.searchParams.has('page')).toBe(false);
    const state = screen.getByTestId('url-state').textContent;
    expect(state).not.toContain('ana');
    expect(state).toContain('"status":"active"');
    expect(state).not.toContain('"page"');
  });

  it('cuts a search longer than 100 characters', async () => {
    const queries: (string | null)[] = [];
    server.use(
      http.get(`${API}/members`, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('q'));
        return HttpResponse.json(page([member()]));
      }),
    );
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Staff' });
    await userEvent.click(screen.getByRole('searchbox', { name: 'Search staff' }));
    await userEvent.paste('a'.repeat(130));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(queries.some((q) => q !== null)).toBe(true);
    });
    expect(queries.find((q) => q !== null)).toHaveLength(100);
  });

  it('pages through the list', async () => {
    const pages: (string | null)[] = [];
    server.use(
      http.get(`${API}/members`, ({ request }) => {
        pages.push(new URL(request.url).searchParams.get('page'));
        return HttpResponse.json(page([member()], { totalItems: 45, totalPages: 3 }));
      }),
    );
    renderWithProviders(<Harness />);
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(pages).toContain('2');
    });
    expect(screen.getByTestId('url-state')).toHaveTextContent('"page":2');
  });

  it('shows a loading state, then an empty state when the clinic has no staff', async () => {
    server.use(http.get(`${API}/members`, () => HttpResponse.json(page([]))));
    renderWithProviders(<Harness />);
    expect(screen.getByText('Loading staff…')).toBeInTheDocument();
    expect(await screen.findByText('No staff yet')).toBeInTheDocument();
  });

  it('says nothing matched and offers to clear the search', async () => {
    server.use(http.get(`${API}/members`, () => HttpResponse.json(page([]))));
    renderWithProviders(<Harness initial={{ status: 'removed' }} />);
    expect(await screen.findByText('No staff match your search')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByTestId('url-state')).toHaveTextContent('{}');
  });

  it('shows the error with its request id and tries again', async () => {
    let failing = true;
    server.use(
      http.get(`${API}/members`, () =>
        failing ? errorBody(500, 'INTERNAL') : HttpResponse.json(page([member()])),
      ),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText(/req-9/)).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Staff' })).toBeInTheDocument();
  });

  it('tells the person a staff member they opened is not on their staff', async () => {
    server.use(http.get(`${API}/members`, () => HttpResponse.json(page([member()]))));
    renderWithProviders(<Harness initial={{ notice: 'missing' }} />);
    expect(await screen.findByText('This person is not on your staff.')).toBeInTheDocument();
  });

  it('never shows one clinic’s staff while another clinic loads', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API}/members`, async () => {
        if (sessionStore.get().status === 'signed-in') {
          const state = sessionStore.get();
          if (state.status === 'signed-in' && state.activeTenantId === 'clinic-b') {
            await gate;
            return HttpResponse.json(
              page([member({ membershipId: 'mb', fullName: 'Beth Bautista' })]),
            );
          }
        }
        return HttpResponse.json(page([member({ fullName: 'Ana Cruz' })]));
      }),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText('Ana Cruz')).toBeInTheDocument();
    act(() => {
      signIn('clinic-b');
    });
    await waitFor(() => {
      expect(screen.queryByText('Ana Cruz')).not.toBeInTheDocument();
    });
    release();
    expect(await screen.findByText('Beth Bautista')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    server.use(http.get(`${API}/members`, () => HttpResponse.json(page([member()]))));
    const { container } = renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Staff' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
