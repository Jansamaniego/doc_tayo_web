import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';
import { mockWideScreen } from '@/test/wide-screen.ts';

import { AdminOverviewPage } from './AdminOverviewPage.tsx';

mockWideScreen();

const API = 'http://localhost:3000/api';

const clinic = (n: number, status = 'active') => ({
  id: `c${n}`,
  name: `Clinic ${String(n).padStart(2, '0')}`,
  slug: `clinic-${n}`,
  status,
  timezone: 'Asia/Manila',
  createdAt: '2026-11-20T17:00:00.000Z',
  memberCount: n,
});
const account = (n: number, status = 'pending') => ({
  id: `u${n}`,
  email: `person${n}@example.com`,
  fullName: `Person ${n}`,
  status,
  platformRole: 'none',
  membershipCount: 1,
});
const meta = (items: number, pageSize: number) => ({
  page: 1,
  pageSize,
  totalItems: items,
  totalPages: Math.ceil(items / pageSize),
});

interface World {
  clinics?: { active: number; suspended: number; deactivated: number };
  users?: { pending: number; active: number; deactivated: number };
  allClinics?: ReturnType<typeof clinic>[];
  suspended?: ReturnType<typeof clinic>[];
  pending?: ReturnType<typeof account>[];
}

/** The API as the overview calls it: a count is a request with pageSize=1 and a status. */
function serve({
  clinics = { active: 3, suspended: 1, deactivated: 2 },
  users = { pending: 2, active: 5, deactivated: 1 },
  allClinics = Array.from({ length: 12 }, (_, i) => clinic(i + 1)),
  suspended = [clinic(40, 'suspended')],
  pending = [account(1), account(2)],
}: World = {}) {
  const requests: string[] = [];
  server.use(
    http.get(`${API}/v1/admin/tenants`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(`tenants ${url.search}`);
      const status = url.searchParams.get('status') as keyof typeof clinics | null;
      const size = Number(url.searchParams.get('pageSize'));
      if (size === 1 && status) {
        return HttpResponse.json({ data: [], meta: meta(clinics[status], 1) });
      }
      if (status === 'suspended') {
        return HttpResponse.json({ data: suspended, meta: meta(suspended.length, size) });
      }
      return HttpResponse.json({
        data: allClinics.slice(0, size),
        meta: meta(allClinics.length, size),
      });
    }),
    http.get(`${API}/v1/admin/users`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(`users ${url.search}`);
      const status = url.searchParams.get('status') as keyof typeof users | null;
      const size = Number(url.searchParams.get('pageSize'));
      if (size === 1 && status)
        return HttpResponse.json({ data: [], meta: meta(users[status], 1) });
      return HttpResponse.json({ data: pending, meta: meta(pending.length, size) });
    }),
    http.get(`${API}/health/ready`, () => HttpResponse.json({ status: 'ok' })),
  );
  return requests;
}

const section = (name: string) => screen.getByRole('region', { name });
const failure = (code: string, status: number) =>
  HttpResponse.json({ error: { status, code, message: 'x', requestId: 'req-2' } }, { status });

describe('AdminOverviewPage', () => {
  it('has one level-1 heading and says it covers all clinics', async () => {
    serve();
    renderWithProviders(<AdminOverviewPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Platform overview' }),
    ).toBeInTheDocument();
    expect(screen.getByText('All clinics on DocTayo')).toBeInTheDocument();
    await screen.findByText('Showing 10 of 12 clinics');
  });

  it('counts clinics by status from the API, and "All clinics" is their sum', async () => {
    serve();
    renderWithProviders(<AdminOverviewPage />);
    const block = section('Clinics at a glance');
    const count = async (label: RegExp, expected: string): Promise<void> => {
      await waitFor(() => {
        expect(within(block).getByRole('link', { name: label })).toHaveTextContent(expected);
      });
    };
    await count(/All clinics/, '6');
    await count(/Active/, '3');
    await count(/Suspended/, '1');
    await count(/Deactivated/, '2');
  });

  it('links each clinic tile to the list with that status', async () => {
    serve();
    renderWithProviders(<AdminOverviewPage />);
    const block = section('Clinics at a glance');
    expect(await within(block).findByRole('link', { name: /All clinics/ })).toHaveAttribute(
      'href',
      '/admin/clinics',
    );
    expect(within(block).getByRole('link', { name: /Active/ })).toHaveAttribute(
      'href',
      '/admin/clinics?status=active',
    );
    expect(within(block).getByRole('link', { name: /Suspended/ })).toHaveAttribute(
      'href',
      '/admin/clinics?status=suspended',
    );
    expect(within(block).getByRole('link', { name: /Deactivated/ })).toHaveAttribute(
      'href',
      '/admin/clinics?status=deactivated',
    );
  });

  it('counts accounts by status, with pending ones called "Waiting to set a password", each linking to the list', async () => {
    serve();
    renderWithProviders(<AdminOverviewPage />);
    const block = section('People');
    const waiting = await within(block).findByRole('link', { name: /Waiting to set a password/ });
    await waitFor(() => {
      expect(waiting).toHaveTextContent('2');
      expect(within(block).getByRole('link', { name: /All accounts/ })).toHaveTextContent('8');
    });
    expect(waiting).toHaveAttribute('href', '/admin/users?status=pending');
    expect(within(block).getByRole('link', { name: /All accounts/ })).toHaveAttribute(
      'href',
      '/admin/users',
    );
    expect(within(block).getByRole('link', { name: /Active/ })).toHaveTextContent('5');
    expect(within(block).getByRole('link', { name: /Deactivated/ })).toHaveTextContent('1');
  });

  it('shows a loading state, never a 0, while the counts are on their way', async () => {
    server.use(
      http.get(`${API}/v1/admin/tenants`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return HttpResponse.json({ data: [], meta: meta(4, 1) });
      }),
      http.get(`${API}/v1/admin/users`, () => HttpResponse.json({ data: [], meta: meta(1, 1) })),
      http.get(`${API}/health/ready`, () => HttpResponse.json({ status: 'ok' })),
    );
    renderWithProviders(<AdminOverviewPage />);
    const block = section('Clinics at a glance');
    expect(within(block).queryByText('0')).not.toBeInTheDocument();
    expect(within(block).getAllByText('Loading…').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(within(block).getByRole('link', { name: /All clinics/ })).toHaveTextContent('12');
    });
  });

  it('lists suspended clinics and accounts waiting for setup, with links to them', async () => {
    serve();
    renderWithProviders(<AdminOverviewPage />);
    const attention = section('Needs attention');
    expect(await within(attention).findByRole('link', { name: 'Clinic 40' })).toHaveAttribute(
      'href',
      '/admin/clinics/c40',
    );
    const person = within(attention).getByRole('link', { name: /Person 1/ });
    expect(person).toHaveAttribute('href', '/admin/users/u1');
    expect(attention).toHaveTextContent('person1@example.com');
    expect(
      within(attention).getByRole('link', { name: 'View all suspended clinics' }),
    ).toHaveAttribute('href', '/admin/clinics?status=suspended');
    expect(
      within(attention).getByRole('link', { name: 'View all waiting accounts' }),
    ).toHaveAttribute('href', '/admin/users?status=pending');
  });

  it('asks for at most five of each list', async () => {
    const requests = serve();
    renderWithProviders(<AdminOverviewPage />);
    await screen.findByText('Showing 10 of 12 clinics');
    expect(requests).toContain('tenants ?pageSize=5&status=suspended');
    expect(requests).toContain('users ?pageSize=5&status=pending');
  });

  it('says plainly when nothing needs attention', async () => {
    serve({ suspended: [], pending: [] });
    renderWithProviders(<AdminOverviewPage />);
    expect(await screen.findByText('No clinics are suspended.')).toBeInTheDocument();
    expect(screen.getByText('Nobody is waiting.')).toBeInTheDocument();
  });

  it('shows the first 10 clinics by name with the status in words, and a way to see them all', async () => {
    serve();
    renderWithProviders(<AdminOverviewPage />);
    const block = section('All clinics');
    const table = await within(block).findByRole('table', { name: 'Clinics' });
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(within(table).getByRole('link', { name: 'Clinic 01' })).toHaveAttribute(
      'href',
      '/admin/clinics/c1',
    );
    expect(table).toHaveTextContent('Active');
    expect(within(block).getByText('Showing 10 of 12 clinics')).toBeInTheDocument();
    expect(within(block).getByRole('link', { name: 'View all clinics' })).toHaveAttribute(
      'href',
      '/admin/clinics',
    );
  });

  it('does not say "Showing" when every clinic fits', async () => {
    serve({ allClinics: [clinic(1), clinic(2)] });
    renderWithProviders(<AdminOverviewPage />);
    await within(section('All clinics')).findByRole('table', { name: 'Clinics' });
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
  });

  it('says the service is ready, and checks again on request', async () => {
    let calls = 0;
    serve();
    server.use(
      http.get(`${API}/health/ready`, () => {
        calls += 1;
        return HttpResponse.json({ status: 'ok' });
      }),
    );
    renderWithProviders(<AdminOverviewPage />);
    const block = section('System status');
    expect(await within(block).findByText('The service is ready')).toBeInTheDocument();
    await userEvent.click(within(block).getByRole('button', { name: 'Check again' }));
    await screen.findByText('The service is ready');
    expect(calls).toBe(2);
  });

  it('says the service is not ready when the API answers 503', async () => {
    serve();
    server.use(http.get(`${API}/health/ready`, () => failure('NOT_READY', 503)));
    renderWithProviders(<AdminOverviewPage />);
    expect(
      await within(section('System status')).findByText('The service is not ready right now'),
    ).toBeInTheDocument();
  });

  it('fails one block on its own: the others still show', async () => {
    serve();
    server.use(http.get(`${API}/v1/admin/users`, () => failure('SERVICE_UNAVAILABLE', 503)));
    renderWithProviders(<AdminOverviewPage />);
    const people = section('People');
    expect(await within(people).findByText(/req-2/)).toBeInTheDocument();
    expect(within(people).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(
      await within(section('Clinics at a glance')).findByRole('link', { name: /All clinics/ }),
    ).toHaveTextContent('6');
    expect(
      await within(section('All clinics')).findByRole('table', { name: 'Clinics' }),
    ).toBeInTheDocument();
  });

  it('labels the activity block as sample data and marks each number as a sample', async () => {
    serve();
    renderWithProviders(<AdminOverviewPage />);
    const block = section('Activity across clinics');
    expect(within(block).getByText('Sample data')).toBeInTheDocument();
    for (const label of ['Appointments today', 'Patients seen today', 'Sign-ins today']) {
      expect(within(block).getByText(label)).toBeInTheDocument();
    }
    expect(within(block).getAllByText('(sample)').length).toBeGreaterThanOrEqual(3);
    expect(
      within(block).getByRole('table', { name: 'Busiest clinics today (sample)' }),
    ).toBeInTheDocument();
    await screen.findByText('Showing 10 of 12 clinics');
  });

  it('has no accessibility violations once loaded, and with a failing block', async () => {
    serve();
    const { container } = renderWithProviders(<AdminOverviewPage />);
    await screen.findByText('Showing 10 of 12 clinics');
    await screen.findByText('The service is ready');
    expect(await axe(container)).toHaveNoViolations();
    server.use(http.get(`${API}/v1/admin/users`, () => failure('SERVICE_UNAVAILABLE', 503)));
    const second = renderWithProviders(<AdminOverviewPage />);
    await within(second.container).findAllByText(/req-2/);
    expect(await axe(second.container)).toHaveNoViolations();
  });
});
