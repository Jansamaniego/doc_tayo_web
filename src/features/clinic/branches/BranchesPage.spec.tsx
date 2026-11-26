import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';
import { mockWideScreen } from '@/test/wide-screen.ts';

import { BranchesPage, type BranchesSearch } from './BranchesPage.tsx';

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
const page = (data: unknown[], over: Record<string, number> = {}) => ({
  data,
  meta: { page: 1, pageSize: 20, totalItems: data.length, totalPages: 1, ...over },
});
const errorBody = (status: number, code: string) =>
  HttpResponse.json({ error: { status, code, message: 'x', requestId: 'req-7' } }, { status });

const signIn = (permissions: string[], activeTenantId = 'clinic-a'): void => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me Myself' },
    memberships: [
      {
        tenantId: activeTenantId,
        tenantName: 'Sunrise Clinic',
        tenantStatus: 'active',
        membershipStatus: 'active',
        roles: [{ key: 'clinic_admin', name: 'Clinic admin' }],
      },
    ],
    activeTenantId,
    permissions,
    platformRole: 'none',
    practitionerProfileId: null,
  });
};
mockWideScreen();
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

function serve(
  reply: (query: URLSearchParams) => Response = () => HttpResponse.json(page([branch()])),
) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/branches`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      queries.push(query);
      return reply(query);
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
  return queries;
}
const render = (search: BranchesSearch = {}, onSearchChange = vi.fn()) =>
  renderWithProviders(<BranchesPage search={search} onSearchChange={onSearchChange} />);

const MANAGER = ['tenant.read', 'branches.read', 'branches.manage'];
const READER = ['tenant.read', 'branches.read'];

describe('BranchesPage', () => {
  it('lists the active branches by default, with the columns in words', async () => {
    signIn(MANAGER);
    const queries = serve(() =>
      HttpResponse.json(
        page([
          branch(),
          branch({ id: 'b2', name: 'Annex', city: null, province: null, timezone: 'Asia/Tokyo' }),
        ]),
      ),
    );
    render();
    const table = await screen.findByRole('table', { name: 'Branches' });
    expect(queries[0]?.get('isActive')).toBe('true');
    expect(within(table).getByRole('link', { name: 'Main' })).toHaveAttribute(
      'href',
      '/clinic/branches/b1',
    );
    expect(within(table).getByText('Quezon City, Metro Manila')).toBeInTheDocument();
    expect(within(table).getByText("Clinic's (Asia/Manila)")).toBeInTheDocument();
    expect(within(table).getByText('Asia/Tokyo')).toBeInTheDocument();
    expect(within(table).getAllByText('Active')).toHaveLength(2);
  });

  it.each([
    ['inactive' as const, 'false'],
    ['all' as const, null],
  ])('asks for the %s filter', async (status, isActive) => {
    signIn(MANAGER);
    const queries = serve();
    render({ status });
    await screen.findByRole('table', { name: 'Branches' });
    expect(queries[0]?.get('isActive')).toBe(isActive);
  });

  it('puts the chosen filter in the address, and starts again at page 1', async () => {
    signIn(MANAGER);
    serve();
    const onSearchChange = vi.fn();
    render({ page: 3 }, onSearchChange);
    await screen.findByRole('table', { name: 'Branches' });
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'Inactive');
    expect(onSearchChange).toHaveBeenCalledWith({ status: 'inactive' });
  });

  it('shows Add branch only to a person who may manage branches', async () => {
    signIn(MANAGER);
    serve();
    const first = render();
    expect(await screen.findByRole('link', { name: 'Add branch' })).toHaveAttribute(
      'href',
      '/clinic/branches/new',
    );
    first.unmount();
    signIn(READER);
    render();
    await screen.findByRole('table', { name: 'Branches' });
    expect(screen.queryByRole('link', { name: 'Add branch' })).not.toBeInTheDocument();
  });

  it('says "No inactive branches" for an empty filter, and offers Add branch for an empty clinic', async () => {
    signIn(MANAGER);
    serve(() => HttpResponse.json(page([])));
    const first = render({ status: 'inactive' });
    expect(await screen.findByText('No inactive branches')).toBeInTheDocument();
    first.unmount();
    render();
    expect(await screen.findByText('No active branches')).toBeInTheDocument();
  });

  it('shows the error with its request id and tries again', async () => {
    signIn(MANAGER);
    let failing = true;
    serve(() => (failing ? errorBody(500, 'INTERNAL_ERROR') : HttpResponse.json(page([branch()]))));
    render();
    expect(await screen.findByText(/req-7/)).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Main' })).toBeInTheDocument();
  });

  it('moves between pages through the address', async () => {
    signIn(MANAGER);
    serve(() => HttpResponse.json(page([branch()], { totalItems: 45, totalPages: 3 })));
    const onSearchChange = vi.fn();
    render({}, onSearchChange);
    await screen.findByRole('link', { name: 'Main' });
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(onSearchChange).toHaveBeenCalledWith({ page: 2 });
  });

  it('asks again for the other clinic after a clinic switch, and never shows the first clinic’s branches meanwhile', async () => {
    signIn(MANAGER, 'clinic-a');
    const queries = serve(() =>
      HttpResponse.json(page([branch({ name: `Branch ${String(queries.length)}` })])),
    );
    render();
    expect(await screen.findByRole('link', { name: 'Branch 1' })).toBeInTheDocument();
    act(() => {
      signIn(MANAGER, 'clinic-b');
    });
    expect(await screen.findByRole('link', { name: 'Branch 2' })).toBeInTheDocument();
    await waitFor(() => {
      expect(queries).toHaveLength(2);
    });
    expect(screen.queryByRole('link', { name: 'Branch 1' })).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    signIn(MANAGER);
    serve();
    const { container } = render();
    await screen.findByRole('link', { name: 'Main' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
