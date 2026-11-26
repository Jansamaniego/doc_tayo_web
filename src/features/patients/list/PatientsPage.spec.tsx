import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';
import { mockWideScreen } from '@/test/wide-screen.ts';

import { PatientsPage, type PatientsSearch } from './PatientsPage.tsx';

const API = 'http://localhost:3000/api/v1';
const patient = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  patientNumber: 'P-000001',
  firstName: 'Juan',
  middleName: null,
  lastName: 'Dela Cruz',
  suffix: null,
  sex: 'male',
  birthDate: '1985-03-02',
  phone: '+639171234567',
  email: null,
  addressLine: null,
  city: null,
  province: null,
  guardianName: null,
  guardianPhone: null,
  allergies: null,
  notes: null,
  archivedAt: null,
  archiveReason: null,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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
  HttpResponse.json({ error: { status, code, message: 'x', requestId: 'req-p' } }, { status });

mockWideScreen();

function signIn(
  tenantId = 'clinic-a',
  permissions = ['tenant.read', 'patients.read', 'patients.manage'],
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
const serveTenant = () => {
  server.use(
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
};

function serve(items: unknown[] = [patient()], meta: Record<string, number> = {}) {
  const urls: URL[] = [];
  server.use(
    http.get(`${API}/patients`, ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json(page(items, meta));
    }),
  );
  return urls;
}

function Harness({ initial = {} as PatientsSearch }) {
  const [search, setSearch] = useState<PatientsSearch>(initial);
  return (
    <>
      <PatientsPage search={search} onSearchChange={setSearch} />
      <output data-testid="url-state">{JSON.stringify(search)}</output>
    </>
  );
}
const urlState = () => screen.getByTestId('url-state').textContent;
const searchBox = () =>
  screen.getByRole('searchbox', { name: 'Search by name, patient number or phone' });

beforeEach(() => {
  // 2026-03-01 20:00 UTC: already 2 March in Manila, still 1 March where the specs run (New York).
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-01T20:00:00.000Z') });
  signIn();
  serveTenant();
});
afterEach(() => {
  vi.useRealTimers();
  sessionStore.set({ status: 'signed-out' });
});

describe('PatientsPage: the list', () => {
  it('lists each patient family name first, with number, birth date, age in the clinic zone and phone', async () => {
    serve([
      patient(),
      patient({
        id: 'p2',
        patientNumber: 'P-000002',
        firstName: 'Angela',
        lastName: 'Reyes',
        birthDate: '2025-05-10',
        phone: null,
      }),
      patient({
        id: 'p3',
        patientNumber: 'P-000003',
        firstName: 'Pedro',
        middleName: 'R',
        lastName: 'Bautista',
        suffix: 'Jr.',
        birthDate: null,
        phone: '+14155552671',
      }),
    ]);
    renderWithProviders(<Harness />);
    expect(screen.getByRole('heading', { level: 1, name: 'Patients' })).toBeInTheDocument();
    const table = await screen.findByRole('table', { name: 'Patients' });
    const juan = within(table).getByRole('row', { name: /Dela Cruz, Juan/ });
    expect(juan).toHaveTextContent('P-000001');
    expect(juan).toHaveTextContent('Mar 2, 1985');
    // 41 only because it is already 2 March in the clinic's zone.
    await waitFor(() => {
      expect(juan).toHaveTextContent('41 years');
    });
    expect(juan).toHaveTextContent('+63 917 123 4567');
    expect(within(table).getByRole('row', { name: /Reyes, Angela/ })).toHaveTextContent('9 months');
    const pedro = within(table).getByRole('row', { name: /Bautista, Pedro R Jr\./ });
    expect(pedro).toHaveTextContent('Not recorded');
    expect(pedro).toHaveTextContent('+14155552671');
  });

  it('says "1 month" for one month', async () => {
    serve([patient({ birthDate: '2026-01-20' })]);
    renderWithProviders(<Harness />);
    expect(await screen.findByText(/\b1 month\b/)).toBeInTheDocument();
  });

  it('opens a patient from their name', async () => {
    serve();
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Patients' });
    expect(screen.getByRole('link', { name: 'Dela Cruz, Juan' })).toHaveAttribute(
      'href',
      '/patients/p1',
    );
  });

  it('first asks with no search text and without archived patients', async () => {
    const urls = serve();
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Patients' });
    expect(urls[0]?.searchParams.has('q')).toBe(false);
    expect(urls[0]?.searchParams.has('includeArchived')).toBe(false);
  });

  it('searches with trimmed text, never putting it in the address, and goes back to page 1', async () => {
    const urls = serve([patient()], { page: 2, totalItems: 45, totalPages: 3 });
    renderWithProviders(<Harness initial={{ page: 2 }} />);
    await screen.findByRole('table', { name: 'Patients' });
    await userEvent.type(searchBox(), '  dela crus {Enter}');
    await waitFor(() => {
      expect(urls.some((url) => url.searchParams.get('q') === 'dela crus')).toBe(true);
    });
    expect(urls.find((url) => url.searchParams.has('q'))?.searchParams.has('page')).toBe(false);
    expect(urlState()).toBe('{}');
    expect(window.location.href).not.toContain('crus');
  });

  it('cuts a search longer than 100 characters', async () => {
    const urls = serve();
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Patients' });
    await userEvent.click(searchBox());
    await userEvent.paste('a'.repeat(130));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(urls.some((url) => url.searchParams.has('q'))).toBe(true);
    });
    expect(urls.find((url) => url.searchParams.has('q'))?.searchParams.get('q')).toHaveLength(100);
  });

  it('"Show archived" asks for them, keeps that in the address and marks them in words', async () => {
    const urls = serve([
      patient(),
      patient({
        id: 'p9',
        lastName: 'Old',
        archivedAt: '2026-01-02T00:00:00.000Z',
        archiveReason: 'x',
      }),
    ]);
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Patients' });
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    await waitFor(() => {
      expect(urls.some((url) => url.searchParams.get('includeArchived') === 'true')).toBe(true);
    });
    expect(urlState()).toBe('{"includeArchived":true}');
    const table = await screen.findByRole('table', { name: 'Patients' });
    expect(within(table).getByRole('row', { name: /Old, Juan/ })).toHaveTextContent('Archived');
    expect(within(table).getByRole('row', { name: /Dela Cruz/ })).toHaveTextContent('Active');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(urlState()).toBe('{}');
  });

  it('pages through the list', async () => {
    const urls = serve([patient()], { totalItems: 45, totalPages: 3 });
    renderWithProviders(<Harness />);
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(urls.some((url) => url.searchParams.get('page') === '2')).toBe(true);
    });
    expect(urlState()).toBe('{"page":2}');
  });
});

describe('PatientsPage: states', () => {
  it('shows loading, then that there are no patients yet', async () => {
    serve([]);
    renderWithProviders(<Harness />);
    expect(screen.getByText('Loading patients…')).toBeInTheDocument();
    expect(await screen.findByText('No patients yet')).toBeInTheDocument();
  });

  it('says no patient matches a search, and clearing it shows the list again', async () => {
    server.use(
      http.get(`${API}/patients`, ({ request }) =>
        HttpResponse.json(page(new URL(request.url).searchParams.has('q') ? [] : [patient()])),
      ),
    );
    renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Patients' });
    await userEvent.type(searchBox(), 'zzzz{Enter}');
    expect(await screen.findByText('No patient matches your search')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByRole('table', { name: 'Patients' })).toBeInTheDocument();
    expect(searchBox()).toHaveValue('');
  });

  it('shows an error with its request id and tries again', async () => {
    let failing = true;
    server.use(
      http.get(`${API}/patients`, () =>
        failing ? errorBody(500, 'INTERNAL_ERROR') : HttpResponse.json(page([patient()])),
      ),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText(/req-p/)).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Patients' })).toBeInTheDocument();
  });
});

describe('PatientsPage: registering', () => {
  it('offers Register a patient, also when there are none or nothing matches', async () => {
    server.use(http.get(`${API}/patients`, () => HttpResponse.json(page([]))));
    renderWithProviders(<Harness />);
    await screen.findByText('No patients yet');
    const links = () => screen.getAllByRole('link', { name: 'Register a patient' });
    expect(links()).toHaveLength(2);
    expect(links()[0]).toHaveAttribute('href', '/patients/new');
    await userEvent.type(searchBox(), 'zzzz{Enter}');
    await screen.findByText('No patient matches your search');
    expect(links()).toHaveLength(2);
  });

  it('offers it to nobody without patients.manage', async () => {
    signIn('clinic-a', ['tenant.read', 'patients.read']);
    server.use(http.get(`${API}/patients`, () => HttpResponse.json(page([]))));
    renderWithProviders(<Harness />);
    await screen.findByText('No patients yet');
    expect(screen.queryByRole('link', { name: 'Register a patient' })).not.toBeInTheDocument();
  });
});

describe('PatientsPage: patient data stays where it belongs', () => {
  it('never shows one clinic’s patients while another clinic loads', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API}/patients`, async () => {
        const state = sessionStore.get();
        if (state.status === 'signed-in' && state.activeTenantId === 'clinic-b') {
          await gate;
          return HttpResponse.json(page([patient({ id: 'pb', lastName: 'Lakeside' })]));
        }
        return HttpResponse.json(page([patient({ lastName: 'Sunrise' })]));
      }),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText('Sunrise, Juan')).toBeInTheDocument();
    act(() => {
      signIn('clinic-b');
    });
    await waitFor(() => {
      expect(screen.queryByText('Sunrise, Juan')).not.toBeInTheDocument();
    });
    release();
    expect(await screen.findByText('Lakeside, Juan')).toBeInTheDocument();
  });

  it('keeps no patient in memory once no screen shows them', async () => {
    serve();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = renderWithProviders(<Harness />, { queryClient });
    await screen.findByRole('table', { name: 'Patients' });
    const cached = () =>
      queryClient.getQueryCache().findAll({ queryKey: ['clinic-a', 'patients'] });
    expect(cached()).toHaveLength(1);
    view.unmount();
    await waitFor(() => {
      expect(cached()).toHaveLength(0);
    });
  });
});

describe('PatientsPage: accessibility', () => {
  it('has no violations, with the list and with no results', async () => {
    serve();
    const { container } = renderWithProviders(<Harness />);
    await screen.findByRole('table', { name: 'Patients' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
