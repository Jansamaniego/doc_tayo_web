import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';
import { mockWideScreen } from '@/test/wide-screen.ts';

import { ClinicsListPage, type ClinicsSearch } from './ClinicsListPage.tsx';

const API = 'http://localhost:3000/api/v1';

const clinic = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Bayview Clinic',
  slug: 'bayview-clinic',
  status: 'active',
  timezone: 'Asia/Manila',
  // 17:00 UTC on Nov 20 is already Nov 21 in Manila, still Nov 20 in New York.
  createdAt: '2026-11-20T17:00:00.000Z',
  memberCount: 4,
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

function Harness({ initial = {} as ClinicsSearch }) {
  const [search, setSearch] = useState<ClinicsSearch>(initial);
  return (
    <>
      <ClinicsListPage search={search} onSearchChange={setSearch} />
      <output data-testid="url-state">{JSON.stringify(search)}</output>
    </>
  );
}

// A wide screen, so the list is a table (a small one shows cards).
mockWideScreen();

describe('ClinicsListPage', () => {
  it("lists clinics with their status in words, active members and created date in the clinic's own time zone", async () => {
    server.use(
      http.get(`${API}/admin/tenants`, () =>
        HttpResponse.json(
          page([
            clinic(),
            clinic({
              id: 'c2',
              name: 'Harbor Clinic',
              slug: 'harbor',
              status: 'suspended',
              timezone: 'America/New_York',
              memberCount: 1,
            }),
          ]),
        ),
      ),
    );
    renderWithProviders(<Harness />);
    expect(screen.getByRole('heading', { level: 1, name: 'Clinics' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Clinics' });
    const bayview = within(table).getByRole('row', { name: /Bayview Clinic/ });
    expect(within(bayview).getByRole('link', { name: 'Bayview Clinic' })).toHaveAttribute(
      'href',
      '/admin/clinics/c1',
    );
    expect(bayview).toHaveTextContent('bayview-clinic');
    expect(bayview).toHaveTextContent('Active');
    expect(bayview).toHaveTextContent('Asia/Manila');
    expect(bayview).toHaveTextContent('Nov 21, 2026');
    const harbor = within(table).getByRole('row', { name: /Harbor Clinic/ });
    expect(harbor).toHaveTextContent('Suspended');
    expect(harbor).toHaveTextContent('Nov 20, 2026');
  });

  it('has one primary action, New clinic, linking to the form', async () => {
    server.use(http.get(`${API}/admin/tenants`, () => HttpResponse.json(page([clinic()]))));
    renderWithProviders(<Harness />);
    expect(await screen.findByRole('link', { name: 'New clinic' })).toHaveAttribute(
      'href',
      '/admin/clinics/new',
    );
  });

  it('asks the API for the page, page size and status it was given', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(`${API}/admin/tenants`, ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json(page([clinic()]));
      }),
    );
    renderWithProviders(<Harness initial={{ page: 2, pageSize: 50, status: 'suspended' }} />);
    await screen.findByRole('table');
    const params = urls[0]?.searchParams;
    expect(params?.get('page')).toBe('2');
    expect(params?.get('pageSize')).toBe('50');
    expect(params?.get('status')).toBe('suspended');
    expect(params?.has('q')).toBe(false);
  });

  it('searches by name or slug, goes back to page 1, and keeps the typed text out of the address state', async () => {
    const queries: (string | null)[] = [];
    server.use(
      http.get(`${API}/admin/tenants`, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get('q'));
        return HttpResponse.json(page([clinic()]));
      }),
    );
    renderWithProviders(<Harness initial={{ page: 3 }} />);
    await screen.findByRole('table');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search clinics' }), 'bay{Enter}');
    await screen.findByRole('table');
    expect(queries).toContain('bay');
    // Page and filters belong to the address; the search text (it may be an email) does not.
    expect(screen.getByTestId('url-state')).toHaveTextContent(/^\{"page":1\}$|^\{\}$/);
    expect(screen.getByTestId('url-state').textContent).not.toContain('bay');
  });

  it('filters by status, back to page 1, and the filter is part of the address state', async () => {
    server.use(http.get(`${API}/admin/tenants`, () => HttpResponse.json(page([clinic()]))));
    renderWithProviders(<Harness initial={{ page: 2 }} />);
    await screen.findByRole('table');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Suspended');
    expect(JSON.parse(screen.getByTestId('url-state').textContent)).toEqual({
      status: 'suspended',
    });
  });

  it('pages through the results', async () => {
    server.use(
      http.get(`${API}/admin/tenants`, ({ request }) => {
        const current = Number(new URL(request.url).searchParams.get('page') ?? 1);
        return HttpResponse.json(
          page([clinic()], { page: current, totalItems: 45, totalPages: 3 }),
        );
      }),
    );
    renderWithProviders(<Harness />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(JSON.parse(screen.getByTestId('url-state').textContent)).toMatchObject({ page: 2 });
  });

  it('says there are no clinics yet, with New clinic', async () => {
    server.use(http.get(`${API}/admin/tenants`, () => HttpResponse.json(page([]))));
    renderWithProviders(<Harness />);
    expect(await screen.findByText('No clinics yet')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'New clinic' }).length).toBeGreaterThan(0);
  });

  it('says nothing matches a search and offers to clear it', async () => {
    server.use(
      http.get(`${API}/admin/tenants`, ({ request }) =>
        HttpResponse.json(new URL(request.url).searchParams.has('q') ? page([]) : page([clinic()])),
      ),
    );
    renderWithProviders(<Harness />);
    await screen.findByRole('table');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search clinics' }), 'zzz{Enter}');
    expect(await screen.findByText(/No clinics match/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('shows an error with the request id and tries again', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/admin/tenants`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              {
                error: {
                  status: 503,
                  code: 'SERVICE_UNAVAILABLE',
                  message: 'x',
                  requestId: 'req-3',
                },
              },
              { status: 503 },
            )
          : HttpResponse.json(page([clinic()]));
      }),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText(/req-3/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    server.use(http.get(`${API}/admin/tenants`, () => HttpResponse.json(page([clinic()]))));
    const { container } = renderWithProviders(<Harness />);
    await screen.findByRole('table');
    expect(await axe(container)).toHaveNoViolations();
  });
});
