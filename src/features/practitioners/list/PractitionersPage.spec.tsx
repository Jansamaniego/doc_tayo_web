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

import { PractitionersPage, type PractitionersSearch } from './PractitionersPage.tsx';

const API = 'http://localhost:3000/api/v1';
const MAIN = 'a0000000-0000-4000-8000-000000000001';
const ANNEX = 'a0000000-0000-4000-8000-000000000002';

const entry = (
  n: number,
  over: Record<string, unknown> = {},
  practitioner: Record<string, unknown> | null = {},
) => ({
  membershipId: `m${n}`,
  fullName: `Person ${n}`,
  jobTitle: null,
  roles: [{ key: 'doctor', name: 'Doctor' }],
  practitioner:
    practitioner === null
      ? null
      : {
          profileId: `p${n}`,
          displayName: `Dr. Person ${n}`,
          specialization: 'General Practice',
          isActive: true,
          ...practitioner,
        },
  ...over,
});
const branches = [
  { id: MAIN, name: 'Main', isActive: true },
  { id: ANNEX, name: 'Quezon City Annex', isActive: true },
];

mockWideScreen();

function signIn(permissions = ['directory.read', 'branches.read'], tenantId = 'clinic-a') {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me' },
    memberships: [],
    activeTenantId: tenantId,
    permissions,
    platformRole: 'none',
    practitionerProfileId: null,
  });
}
const manage = () => {
  signIn(['directory.read', 'branches.read', 'practitioners.manage']);
};

/** A directory of `entries`; `byBranch` answers a `branchId` filter. */
function serve(entries: unknown[] = [entry(1)], byBranch: Record<string, unknown[]> = {}) {
  const requests: URL[] = [];
  server.use(
    http.get(`${API}/directory`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const branch = url.searchParams.get('branchId');
      const data = branch ? (byBranch[branch] ?? []) : entries;
      return HttpResponse.json({
        data,
        meta: { page: 1, pageSize: 100, totalItems: data.length, totalPages: 1 },
      });
    }),
    http.get(`${API}/branches`, () =>
      HttpResponse.json({
        data: branches,
        meta: { page: 1, pageSize: 100, totalItems: 2, totalPages: 1 },
      }),
    ),
  );
  return requests;
}

function Harness({ initial = {} as PractitionersSearch }) {
  const [search, setSearch] = useState<PractitionersSearch>(initial);
  return (
    <>
      <PractitionersPage search={search} onSearchChange={setSearch} />
      <output data-testid="url-state">{JSON.stringify(search)}</output>
    </>
  );
}
const urlState = () => screen.getByTestId('url-state').textContent;
const table = () => screen.findByRole('table', { name: 'Practitioners' });
const branchFilter = () => screen.findByRole('combobox', { name: 'Branch' });

beforeEach(() => {
  signIn();
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('PractitionersPage: the list', () => {
  it('lists only the staff who have a practitioner profile, with specialization and the person', async () => {
    serve([
      entry(1, { jobTitle: 'Senior physician' }),
      entry(2, {}, null),
      entry(3, {}, { specialization: null }),
    ]);
    renderWithProviders(<Harness />);
    expect(screen.getByRole('heading', { level: 1, name: 'Practitioners' })).toBeInTheDocument();
    const rows = await table();
    const first = within(rows).getByRole('row', { name: /Dr\. Person 1/ });
    expect(first).toHaveTextContent('General Practice');
    expect(first).toHaveTextContent('Person 1');
    expect(first).toHaveTextContent('Senior physician');
    expect(within(rows).getByRole('row', { name: /Dr\. Person 3/ })).toHaveTextContent(
      'Not recorded',
    );
    expect(within(rows).queryByText('Dr. Person 2')).not.toBeInTheDocument();
    expect(within(rows).queryByText('Person 2')).not.toBeInTheDocument();
  });

  it('shows no e-mail address anywhere', async () => {
    serve();
    renderWithProviders(<Harness />);
    await table();
    expect(document.body.textContent).not.toContain('@');
  });

  it('opens a practitioner from their name', async () => {
    serve();
    renderWithProviders(<Harness />);
    await table();
    expect(screen.getByRole('link', { name: 'Dr. Person 1' })).toHaveAttribute(
      'href',
      '/practitioners/p1',
    );
  });

  it('reads the whole directory, including profiles the manager may need to see', async () => {
    const requests = serve();
    renderWithProviders(<Harness />);
    await table();
    expect(requests[0]?.searchParams.get('pageSize')).toBe('100');
    expect(requests[0]?.searchParams.has('practitionersOnly')).toBe(false);
  });
});

describe('PractitionersPage: inactive practitioners', () => {
  const both = [entry(1), entry(2, {}, { isActive: false })];

  it('are hidden from people who cannot manage practitioners, with no Status column', async () => {
    serve(both);
    renderWithProviders(<Harness />);
    const rows = await table();
    expect(within(rows).queryByText('Dr. Person 2')).not.toBeInTheDocument();
    expect(within(rows).queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
  });

  it('are shown to managers, marked in words', async () => {
    manage();
    serve(both);
    renderWithProviders(<Harness />);
    const rows = await table();
    expect(within(rows).getByRole('row', { name: /Dr\. Person 1/ })).toHaveTextContent('Active');
    expect(within(rows).getByRole('row', { name: /Dr\. Person 2/ })).toHaveTextContent('Inactive');
  });
});

describe('PractitionersPage: the branch filter', () => {
  it('offers All branches and the active branches', async () => {
    serve();
    renderWithProviders(<Harness />);
    const select = await branchFilter();
    await waitFor(() => {
      expect(
        within(select)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['All branches', 'Main', 'Quezon City Annex']);
    });
  });

  it('asks for the chosen branch, keeps it in the address state and goes back to page 1', async () => {
    const requests = serve([entry(1)], { [ANNEX]: [entry(9)] });
    renderWithProviders(<Harness initial={{ page: 1 }} />);
    await table();
    await userEvent.selectOptions(await branchFilter(), 'Quezon City Annex');
    expect(await screen.findByText('Dr. Person 9')).toBeInTheDocument();
    expect(requests.at(-1)?.searchParams.get('branchId')).toBe(ANNEX);
    expect(urlState()).toBe(`{"branch":"${ANNEX}"}`);
    await userEvent.selectOptions(await branchFilter(), 'All branches');
    expect(urlState()).toBe('{}');
  });

  it('says no practitioner works at a branch, and offers all branches', async () => {
    serve([entry(1)], { [ANNEX]: [] });
    renderWithProviders(<Harness initial={{ branch: ANNEX }} />);
    expect(await screen.findByText('No practitioner works at this branch')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show all branches' }));
    expect(await screen.findByText('Dr. Person 1')).toBeInTheDocument();
    expect(urlState()).toBe('{}');
  });
});

describe('PractitionersPage: adding', () => {
  const links = () => screen.getAllByRole('link', { name: 'Add a practitioner' });

  it('offers managers Add a practitioner, also when there are none', async () => {
    manage();
    serve([entry(1, {}, null)]);
    renderWithProviders(<Harness />);
    await screen.findByText('No practitioners yet');
    expect(links()).toHaveLength(2);
    expect(links()[0]).toHaveAttribute('href', '/practitioners/new');
  });

  it('offers it to nobody else', async () => {
    serve([entry(1, {}, null)]);
    renderWithProviders(<Harness />);
    await screen.findByText('No practitioners yet');
    expect(screen.queryByRole('link', { name: 'Add a practitioner' })).not.toBeInTheDocument();
  });
});

describe('PractitionersPage: pages and states', () => {
  it('shows 20 at a time and pages through them', async () => {
    serve(Array.from({ length: 25 }, (_, index) => entry(index + 1)));
    renderWithProviders(<Harness />);
    const rows = await table();
    expect(within(rows).getAllByRole('row')).toHaveLength(21); // with the header
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(urlState()).toBe('{"page":2}');
    expect(await screen.findByText('Dr. Person 25')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Person 1')).not.toBeInTheDocument();
  });

  it('shows the last page when the address asks for one past the end', async () => {
    serve([entry(1)]);
    renderWithProviders(<Harness initial={{ page: 9 }} />);
    expect(await screen.findByText('Dr. Person 1')).toBeInTheDocument();
  });

  it('shows loading, then that there are no practitioners yet', async () => {
    serve([entry(1, {}, null)]);
    renderWithProviders(<Harness />);
    expect(screen.getByText('Loading practitioners…')).toBeInTheDocument();
    expect(await screen.findByText('No practitioners yet')).toBeInTheDocument();
  });

  it('shows an error with its request id and tries again', async () => {
    let failing = true;
    serve();
    server.use(
      http.get(`${API}/directory`, () =>
        failing
          ? HttpResponse.json(
              { error: { status: 500, code: 'INTERNAL_ERROR', message: 'x', requestId: 'req-d' } },
              { status: 500 },
            )
          : HttpResponse.json({
              data: [entry(1)],
              meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
            }),
      ),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText(/req-d/)).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Dr. Person 1')).toBeInTheDocument();
  });

  it('never shows one clinic’s practitioners while another clinic loads', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    serve();
    server.use(
      http.get(`${API}/directory`, async () => {
        const state = sessionStore.get();
        const other = state.status === 'signed-in' && state.activeTenantId === 'clinic-b';
        if (other) await gate;
        const data = [entry(other ? 2 : 1)];
        return HttpResponse.json({
          data,
          meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
        });
      }),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText('Dr. Person 1')).toBeInTheDocument();
    act(() => {
      signIn(undefined, 'clinic-b');
    });
    await waitFor(() => {
      expect(screen.queryByText('Dr. Person 1')).not.toBeInTheDocument();
    });
    release();
    expect(await screen.findByText('Dr. Person 2')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    manage();
    serve([entry(1), entry(2, {}, { isActive: false })]);
    const { container } = renderWithProviders(<Harness />);
    await table();
    expect(await axe(container)).toHaveNoViolations();
  });
});
