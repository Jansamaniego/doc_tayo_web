import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';
import { mockWideScreen } from '@/test/wide-screen.ts';

import { UsersListPage, type UsersSearch } from './UsersListPage.tsx';

const API = 'http://localhost:3000/api/v1';
const user = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'ana@example.com',
  fullName: 'Ana Cruz',
  status: 'active',
  platformRole: 'none',
  membershipCount: 2,
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

mockWideScreen();

function Harness({ initial = {} as UsersSearch }) {
  const [search, setSearch] = useState<UsersSearch>(initial);
  return (
    <>
      <UsersListPage search={search} onSearchChange={setSearch} />
      <output data-testid="url-state">{JSON.stringify(search)}</output>
    </>
  );
}

describe('UsersListPage', () => {
  it('lists accounts with status in words, a Platform admin badge and the number of clinics', async () => {
    server.use(
      http.get(`${API}/admin/users`, () =>
        HttpResponse.json(
          page([
            user(),
            user({
              id: 'u2',
              email: 'admin@doctayo.test',
              fullName: 'Platform Admin',
              platformRole: 'platform_admin',
              membershipCount: 0,
            }),
            user({
              id: 'u3',
              email: 'new@example.com',
              fullName: 'New Owner',
              status: 'pending',
              membershipCount: 1,
            }),
            user({
              id: 'u4',
              email: 'gone@example.com',
              fullName: 'Gone Person',
              status: 'deactivated',
            }),
          ]),
        ),
      ),
    );
    renderWithProviders(<Harness />);
    expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Users' });
    const ana = within(table).getByRole('row', { name: /Ana Cruz/ });
    expect(within(ana).getByRole('link', { name: 'Ana Cruz' })).toHaveAttribute(
      'href',
      '/admin/users/u1',
    );
    expect(ana).toHaveTextContent('ana@example.com');
    expect(ana).toHaveTextContent('Active');
    expect(ana).not.toHaveTextContent('Platform admin');
    expect(within(table).getByRole('row', { name: /Platform Admin/ })).toHaveTextContent(
      'Platform admin',
    );
    expect(within(table).getByRole('row', { name: /New Owner/ })).toHaveTextContent('Pending');
    expect(within(table).getByRole('row', { name: /Gone Person/ })).toHaveTextContent(
      'Deactivated',
    );
  });

  it('searches by name or email, back to page 1, and keeps the typed text out of the address state', async () => {
    const queries: (string | null)[] = [];
    server.use(
      http.get(`${API}/admin/users`, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('q'));
        return HttpResponse.json(page([user()]));
      }),
    );
    renderWithProviders(<Harness initial={{ page: 3 }} />);
    await screen.findByRole('table');
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search users' }),
      'ana@example.com{Enter}',
    );
    await screen.findByRole('table');
    expect(queries).toContain('ana@example.com');
    expect(screen.getByTestId('url-state').textContent).not.toContain('ana');
    expect(screen.getByTestId('url-state')).toHaveTextContent('{}');
  });

  it('filters by status (Pending, Active, Deactivated), back to page 1', async () => {
    const statuses: (string | null)[] = [];
    server.use(
      http.get(`${API}/admin/users`, ({ request }) => {
        statuses.push(new URL(request.url).searchParams.get('status'));
        return HttpResponse.json(page([user()]));
      }),
    );
    renderWithProviders(<Harness initial={{ page: 2 }} />);
    await screen.findByRole('table');
    const select = screen.getByLabelText('Status');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['All', 'Pending', 'Active', 'Deactivated']);
    await userEvent.selectOptions(select, 'Pending');
    expect(JSON.parse(screen.getByTestId('url-state').textContent)).toEqual({ status: 'pending' });
    await screen.findByRole('table');
    expect(statuses).toContain('pending');
  });

  it('pages through the results', async () => {
    server.use(
      http.get(`${API}/admin/users`, ({ request }) => {
        const current = Number(new URL(request.url).searchParams.get('page') ?? 1);
        return HttpResponse.json(page([user()], { page: current, totalItems: 45, totalPages: 3 }));
      }),
    );
    renderWithProviders(<Harness />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(JSON.parse(screen.getByTestId('url-state').textContent)).toMatchObject({ page: 2 });
  });

  it('says there are no users, or that nothing matches a search, with a way to clear it', async () => {
    server.use(
      http.get(`${API}/admin/users`, ({ request }) =>
        HttpResponse.json(new URL(request.url).searchParams.has('q') ? page([]) : page([user()])),
      ),
    );
    renderWithProviders(<Harness />);
    await screen.findByRole('table');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search users' }), 'zzz{Enter}');
    expect(await screen.findByText(/No users match/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('shows an error with the request id and tries again', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/admin/users`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              {
                error: {
                  status: 503,
                  code: 'SERVICE_UNAVAILABLE',
                  message: 'x',
                  requestId: 'req-4',
                },
              },
              { status: 503 },
            )
          : HttpResponse.json(page([user()]));
      }),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText(/req-4/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    server.use(http.get(`${API}/admin/users`, () => HttpResponse.json(page([user()]))));
    const { container } = renderWithProviders(<Harness />);
    await screen.findByRole('table');
    expect(await axe(container)).toHaveNoViolations();
  });
});
