import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { readPreference, writePreference } from '@/lib/preferences.ts';
import { appointmentAnswer } from '@/test/appointments.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';
import { mockWideScreen } from '@/test/wide-screen.ts';

import type { DaySearch } from './day-search.ts';
import { DayViewPage } from './DayViewPage.tsx';

const API = 'http://localhost:3000/api/v1';
const MAIN = 'a0000000-0000-4000-8000-000000000001';
const ANNEX = 'a0000000-0000-4000-8000-000000000002';
const DAN = 'b0000000-0000-4000-8000-000000000001';
const MAYA = 'b0000000-0000-4000-8000-000000000002';

mockWideScreen();

const ALL = ['appointments.read', 'patients.read', 'directory.read', 'branches.read'];

function signIn({
  permissions = ALL,
  practitionerProfileId = null,
}: { permissions?: string[]; practitionerProfileId?: string | null } = {}) {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me' },
    memberships: [],
    activeTenantId: 'clinic-a',
    permissions,
    platformRole: 'none',
    practitionerProfileId,
  });
}

const branch = (id: string, name: string, timezone: string | null = null) => ({
  id,
  name,
  timezone,
  isActive: true,
});

interface Served {
  appointments?: unknown[];
  branches?: ReturnType<typeof branch>[];
  /** Branches the practitioner `pr1` has hours at. */
  scheduledAt?: string[];
}

/** Serves everything the page reads; returns the appointment requests and every other address. */
function serve({
  appointments = [appointmentAnswer()],
  branches = [branch(MAIN, 'Main'), branch(ANNEX, 'Quezon City Annex')],
  scheduledAt = [MAIN],
}: Served = {}) {
  const requests: URL[] = [];
  const others: URL[] = [];
  const page = <Item,>(data: Item[]) => ({
    data,
    meta: { page: 1, pageSize: 100, totalItems: data.length, totalPages: data.length ? 1 : 0 },
  });
  server.use(
    http.get(`${API}/appointments`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(page(appointments));
    }),
    http.get(`${API}/branches`, ({ request }) => {
      others.push(new URL(request.url));
      return HttpResponse.json(page(branches));
    }),
    http.get(`${API}/tenant`, () => HttpResponse.json({ data: { timezone: 'Asia/Manila' } })),
    http.get(`${API}/directory`, ({ request }) => {
      others.push(new URL(request.url));
      return HttpResponse.json(
        page(
          [
            { membershipId: DAN, name: 'Dr. Dan Doctor, MD' },
            { membershipId: MAYA, name: 'Dr. Maya Multi, MD' },
          ].map(({ membershipId, name }) => ({
            membershipId,
            fullName: name,
            jobTitle: null,
            roles: [],
            practitioner: {
              profileId: membershipId,
              displayName: name,
              specialization: null,
              isActive: true,
            },
          })),
        ),
      );
    }),
    http.get(`${API}/practitioners/pr1`, ({ request }) => {
      others.push(new URL(request.url));
      return HttpResponse.json({
        data: {
          id: 'pr1',
          membershipId: DAN,
          displayName: 'Dr. Dan Doctor, MD',
          specialization: null,
          prcLicenseNumber: null,
          ptrNumber: null,
          isActive: true,
          schedule: scheduledAt.map((branchId, index) => ({
            branchId,
            weekday: index + 1,
            startsAt: '09:00',
            endsAt: '12:00',
          })),
        },
      });
    }),
  );
  return { requests, others };
}

function Harness({ initial = {} }: { initial?: DaySearch }) {
  const [search, setSearch] = useState<DaySearch>(initial);
  return (
    <>
      <DayViewPage search={search} onSearchChange={setSearch} />
      <output data-testid="url-state">{JSON.stringify(search)}</output>
    </>
  );
}
const urlState = () => JSON.parse(screen.getByTestId('url-state').textContent) as DaySearch;
const table = () => screen.findByRole('table', { name: 'Appointments' });
const last = (requests: URL[]) => requests.at(-1)?.searchParams;
const asked = async (requests: URL[], name: string, value: string | null) => {
  await waitFor(() => {
    expect(last(requests)?.get(name) ?? null).toBe(value);
  });
};

beforeEach(() => {
  // 00:30 on Monday 7 December in Manila; still Sunday 6 December in New York (the runner).
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-12-06T16:30:00.000Z') });
  window.localStorage.clear();
  signIn();
});
afterEach(() => {
  vi.useRealTimers();
  focusManager.setFocused(undefined);
  sessionStore.set({ status: 'signed-out' });
});

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

describe('DayViewPage: the day', () => {
  it('shows today in the branch’s zone, always asking for that date', async () => {
    const { requests } = serve();
    const { container } = renderWithProviders(<Harness />);
    expect(screen.getByRole('heading', { level: 1, name: 'Appointments' })).toBeInTheDocument();
    await table();
    expect(last(requests)?.get('date')).toBe('2026-12-07');
    expect(last(requests)?.get('branchId')).toBe(MAIN);
    expect(last(requests)?.get('pageSize')).toBe('100');
    expect(screen.getByRole('heading', { level: 2, name: /Mon, Dec 7, 2026/ })).toBeInTheDocument();
    expect(document.title).toBe('Appointments');
    expect(screen.queryByText(/Times are in/)).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('uses the branch’s own zone, and says so', async () => {
    const { requests } = serve({ branches: [branch(MAIN, 'Hawaii', 'Pacific/Honolulu')] });
    renderWithProviders(<Harness />);
    await table();
    expect(last(requests)?.get('date')).toBe('2026-12-06');
    expect(screen.getByText('Times are in Pacific/Honolulu.')).toBeInTheDocument();
    expect(within(await table()).getByText('3:00 PM – 3:30 PM')).toBeInTheDocument();
  });

  it('moves to the previous and next day, and back to today', async () => {
    const { requests } = serve();
    renderWithProviders(<Harness />);
    await table();
    await user().click(screen.getByRole('button', { name: 'Next day' }));
    await asked(requests, 'date', '2026-12-08');
    expect(urlState().date).toBe('2026-12-08');
    await user().click(screen.getByRole('button', { name: 'Previous day' }));
    await asked(requests, 'date', '2026-12-07');
    // Today is not kept in the address: the view goes on following it.
    expect(urlState().date).toBeUndefined();
    await user().click(screen.getByRole('button', { name: 'Previous day' }));
    await asked(requests, 'date', '2026-12-06');
    await user().click(screen.getByRole('button', { name: 'Today' }));
    await asked(requests, 'date', '2026-12-07');
    expect(urlState().date).toBeUndefined();
  });

  it('shows a typed day, and keeps the day while it is incomplete', async () => {
    const { requests } = serve();
    renderWithProviders(<Harness />);
    await table();
    const day = screen.getByLabelText('Day');
    await user().clear(day);
    expect(urlState().date).toBeUndefined();
    await user().type(day, '15');
    await asked(requests, 'date', '2026-12-15');
    expect(urlState().date).toBe('2026-12-15');
    expect(
      requests.every((url) => /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date') ?? '')),
    ).toBe(true);
  });

  it('moves a view of today to the next day at the branch’s midnight', async () => {
    vi.setSystemTime(new Date('2026-12-07T15:59:30.000Z')); // 23:59:30 in Manila
    const { requests } = serve();
    renderWithProviders(<Harness />);
    await table();
    expect(last(requests)?.get('date')).toBe('2026-12-07');
    await act(() => vi.advanceTimersByTimeAsync(31_000));
    await asked(requests, 'date', '2026-12-08');
  });

  it('stays on a chosen day over midnight', async () => {
    vi.setSystemTime(new Date('2026-12-07T15:59:30.000Z'));
    const { requests } = serve();
    renderWithProviders(<Harness initial={{ date: '2026-12-01' }} />);
    await table();
    await act(() => vi.advanceTimersByTimeAsync(31_000));
    expect(requests.map((url) => url.searchParams.get('date'))).toEqual(['2026-12-01']);
  });
});

describe('DayViewPage: the branch', () => {
  const picker = () => screen.findByRole('combobox', { name: 'Branch' });

  it('lists the active branches and remembers the choice on this computer', async () => {
    const { requests, others } = serve();
    renderWithProviders(<Harness />);
    await user().selectOptions(await picker(), 'Quezon City Annex');
    await asked(requests, 'branchId', ANNEX);
    expect(urlState().branch).toBe(ANNEX);
    expect(readPreference('lastBranchId')).toBe(ANNEX);
    const branches = others.find((url) => url.pathname.endsWith('/branches'));
    expect(branches?.searchParams.get('isActive')).toBe('true');
  });

  it('starts on the remembered branch', async () => {
    writePreference('lastBranchId', ANNEX);
    const { requests } = serve();
    renderWithProviders(<Harness />);
    await table();
    expect(requests.map((url) => url.searchParams.get('branchId'))).toEqual([ANNEX]);
    expect(await picker()).toHaveValue(ANNEX);
  });

  it.each([
    [
      'a remembered branch',
      () => {
        writePreference('lastBranchId', 'gone');
      },
      {},
    ],
    [
      'a branch in the address',
      () => undefined,
      { branch: 'a0000000-0000-4000-8000-00000000000f' },
    ],
  ])('ignores %s that is not one of the clinic’s', async (_name, arrange, initial) => {
    arrange();
    const { requests } = serve();
    renderWithProviders(<Harness initial={initial} />);
    await table();
    expect(requests.map((url) => url.searchParams.get('branchId'))).toEqual([MAIN]);
  });

  it('shows no picker in a one-branch clinic', async () => {
    serve({ branches: [branch(MAIN, 'Main')] });
    renderWithProviders(<Harness />);
    await table();
    expect(screen.queryByRole('combobox', { name: 'Branch' })).not.toBeInTheDocument();
  });

  it('says to add a branch when there is no active one, asking for no appointments', async () => {
    // An unexpected request fails the test.
    const { requests } = serve({ branches: [] });
    renderWithProviders(<Harness />);
    expect(
      await screen.findByText('Add an active branch before booking appointments.'),
    ).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it('shows a failure to read the branches, with its request id', async () => {
    serve();
    server.use(
      http.get(`${API}/branches`, () =>
        HttpResponse.json(
          { error: { status: 500, code: 'INTERNAL_ERROR', message: 'No', requestId: 'req-b' } },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByText('Reference: req-b')).toBeInTheDocument();
  });
});

describe('DayViewPage: filters', () => {
  it.each([
    ['Checked in', 'checked_in', 'checked_in'],
    ['All', 'all', null],
    ['Cancelled and no-show', 'closed', 'cancelled,no_show'],
  ])('the %s tab', async (label, kept, sent) => {
    const { requests } = serve();
    renderWithProviders(<Harness />);
    await table();
    await asked(requests, 'status', 'scheduled,checked_in');
    await user().click(screen.getByRole('tab', { name: label }));
    await asked(requests, 'status', sent);
    expect(urlState().status).toBe(kept);
    await user().click(screen.getByRole('tab', { name: 'Active' }));
    expect(urlState().status).toBeUndefined();
  });

  it('filters by one practitioner from the directory', async () => {
    const { requests, others } = serve();
    renderWithProviders(<Harness />);
    const filter = await screen.findByRole('combobox', { name: 'Practitioner' });
    await within(filter).findByRole('option', { name: 'Dr. Maya Multi, MD' });
    await user().selectOptions(filter, 'Dr. Maya Multi, MD');
    await asked(requests, 'practitionerMembershipId', MAYA);
    expect(urlState().practitioner).toBe(MAYA);
    const directory = others.find((url) => url.pathname.endsWith('/directory'));
    expect(directory?.searchParams.get('practitionersOnly')).toBe('true');
    await user().selectOptions(filter, 'All practitioners');
    await asked(requests, 'practitionerMembershipId', null);
    expect(urlState().practitioner).toBeUndefined();
  });

  it('shows that a practitioner outside the list is chosen, never "All"', async () => {
    serve();
    const other = 'b0000000-0000-4000-8000-00000000000f';
    renderWithProviders(<Harness initial={{ practitioner: other }} />);
    const filter = await screen.findByRole('combobox', { name: 'Practitioner' });
    await within(filter).findByRole('option', { name: 'Practitioner not in the list' });
    expect(filter).toHaveValue(other);
  });

  it('offers no practitioner filter without directory.read, asking for no directory', async () => {
    signIn({ permissions: ['appointments.read', 'branches.read'] });
    const { others } = serve();
    renderWithProviders(<Harness />);
    await table();
    expect(screen.queryByRole('combobox', { name: 'Practitioner' })).not.toBeInTheDocument();
    expect(others.some((url) => url.pathname.endsWith('/directory'))).toBe(false);
  });

  it('offers no "My appointments" to someone who is not a practitioner', async () => {
    serve();
    renderWithProviders(<Harness />);
    await table();
    expect(screen.queryByRole('button', { name: 'My appointments' })).not.toBeInTheDocument();
  });

  it('shows only my own appointments, and everyone’s again', async () => {
    signIn({ practitionerProfileId: 'pr1' });
    const { requests } = serve();
    renderWithProviders(<Harness />);
    const mine = await screen.findByRole('button', { name: 'My appointments' });
    expect(mine).toHaveAttribute('aria-pressed', 'false');
    await user().click(mine);
    await asked(requests, 'practitionerMembershipId', DAN);
    expect(mine).toHaveAttribute('aria-pressed', 'true');
    await user().click(mine);
    await asked(requests, 'practitionerMembershipId', null);
  });

  it('lists my branches first when I work at more than one', async () => {
    signIn({ practitionerProfileId: 'pr1' });
    const third = 'a0000000-0000-4000-8000-000000000003';
    serve({
      branches: [branch(MAIN, 'Main'), branch(ANNEX, 'Annex'), branch(third, 'North')],
      scheduledAt: [ANNEX, third],
    });
    renderWithProviders(<Harness />);
    const picker = await screen.findByRole('combobox', { name: 'Branch' });
    await waitFor(() => {
      expect(
        within(picker)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Annex', 'North', 'Main']);
    });
    // The branch on screen does not jump when the order arrives.
    expect(picker).toHaveValue(MAIN);
  });
});

describe('DayViewPage: the rows', () => {
  const rows = [
    appointmentAnswer({
      id: 'walk',
      kind: 'walk_in',
      status: 'checked_in',
      startsAt: '2026-12-07T00:45:00.000Z',
      endsAt: '2026-12-07T01:15:00.000Z',
      checkedInAt: '2026-12-07T00:45:00.000Z',
      service: null,
      reason: null,
      patient: { id: 'p2', patientNumber: 'P-000002', firstName: 'Lourdes', lastName: 'Navarro' },
    }),
    appointmentAnswer(),
    appointmentAnswer({
      id: 'gone',
      status: 'cancelled',
      cancelledAt: '2026-12-06T08:00:00.000Z',
      cancelReason: 'Patient called to cancel',
      startsAt: '2026-12-07T03:30:00.000Z',
      endsAt: '2026-12-07T04:00:00.000Z',
      patient: { id: 'p3', patientNumber: 'P-000003', firstName: 'Pedro', lastName: 'Bautista' },
    }),
  ];

  it('shows each appointment in the API’s order', async () => {
    serve({ appointments: rows });
    const { container } = renderWithProviders(<Harness initial={{ status: 'all' }} />);
    const body = within(await table())
      .getAllByRole('row')
      .slice(1);
    expect(body).toHaveLength(3);
    const [walkIn, booked, cancelled] = body as [HTMLElement, HTMLElement, HTMLElement];
    expect(walkIn).toHaveTextContent('Arrived 8:45 AM');
    expect(walkIn).not.toHaveTextContent('9:15 AM');
    expect(walkIn).toHaveTextContent('Walk-in');
    expect(walkIn).toHaveTextContent('Checked in');
    expect(walkIn).toHaveTextContent('No service');
    expect(walkIn).toHaveTextContent('Not given');
    expect(walkIn).toHaveTextContent('Navarro, Lourdes');
    expect(booked).toHaveTextContent('9:00 AM – 9:30 AM');
    expect(booked).toHaveTextContent('P-000001');
    expect(booked).toHaveTextContent('Follow-up');
    expect(booked).toHaveTextContent('Annual check-up');
    expect(booked).toHaveTextContent('Scheduled');
    expect(booked).not.toHaveTextContent('Walk-in');
    expect(cancelled).toHaveTextContent('Cancelled');
    expect(
      within(booked).getByRole('link', { name: '9:00 AM to 9:30 AM, Juan Dela Cruz' }),
    ).toHaveAttribute('href', '/appointments/ap000000-0000-4000-8000-000000000001');
    expect(within(booked).getByRole('link', { name: 'Dela Cruz, Juan' })).toHaveAttribute(
      'href',
      '/patients/p1',
    );
    expect(within(booked).getByRole('link', { name: 'Dr. Dan Doctor, MD' })).toHaveAttribute(
      'href',
      '/practitioners/pr1',
    );
    expect(screen.getByText('3 appointments found')).toBeInTheDocument();
    expect(document.title).toBe('Appointments');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('links to the patient and the practitioner only for those who may open them', async () => {
    signIn({ permissions: ['appointments.read', 'branches.read'] });
    serve();
    renderWithProviders(<Harness />);
    const rowsShown = await table();
    expect(within(rowsShown).getByText('Dela Cruz, Juan')).toBeInTheDocument();
    expect(within(rowsShown).getAllByRole('link')).toHaveLength(1);
  });

  it('says there are no appointments on the day', async () => {
    serve({ appointments: [] });
    renderWithProviders(<Harness initial={{ status: 'all' }} />);
    expect(await screen.findByText('No appointments on this day')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show all' })).not.toBeInTheDocument();
  });

  it('names the filters of an empty list and clears them', async () => {
    const { requests } = serve({ appointments: [] });
    renderWithProviders(<Harness initial={{ practitioner: MAYA }} />);
    expect(await screen.findByText('No appointments on this day')).toBeInTheDocument();
    expect(await screen.findByText('Showing: Active, Dr. Maya Multi, MD.')).toBeInTheDocument();
    await user().click(screen.getByRole('button', { name: 'Show all' }));
    await asked(requests, 'status', null);
    expect(last(requests)?.has('practitionerMembershipId')).toBe(false);
    expect(urlState()).toEqual({ status: 'all' });
  });

  it('shows a failure with its request id and tries again', async () => {
    serve();
    let fail = true;
    server.use(
      http.get(`${API}/appointments`, () =>
        fail
          ? HttpResponse.json(
              { error: { status: 500, code: 'INTERNAL_ERROR', message: 'No', requestId: 'req-a' } },
              { status: 500 },
            )
          : HttpResponse.json({
              data: [appointmentAnswer()],
              meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
            }),
      ),
    );
    renderWithProviders(<Harness />);
    expect(await screen.findByText('Reference: req-a')).toBeInTheDocument();
    fail = false;
    await user().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await table()).toBeInTheDocument();
  });
});

describe('DayViewPage: booking', () => {
  const manage = () => {
    signIn({ permissions: [...ALL, 'appointments.manage'] });
  };

  it('opens the booking form and the walk-in form with the branch and day', async () => {
    manage();
    serve();
    const { container } = renderWithProviders(<Harness initial={{ date: '2026-12-10' }} />);
    await table();
    expect(screen.getByRole('link', { name: 'Book an appointment' })).toHaveAttribute(
      'href',
      `/appointments/new?branch=${MAIN}&date=2026-12-10`,
    );
    // A walk-in is here now: it takes no day.
    expect(screen.getByRole('link', { name: 'Register a walk-in' })).toHaveAttribute(
      'href',
      `/appointments/new?branch=${MAIN}&kind=walk_in`,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('offers neither to someone who may only read', async () => {
    serve();
    renderWithProviders(<Harness />);
    await table();
    expect(screen.queryByRole('link', { name: 'Book an appointment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Register a walk-in' })).not.toBeInTheDocument();
  });
});

describe('DayViewPage: keeping up to date', () => {
  it('reads the day again every 60 seconds, but not while the window is hidden', async () => {
    const { requests } = serve();
    renderWithProviders(<Harness />);
    await table();
    expect(requests).toHaveLength(1);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    await waitFor(() => {
      expect(requests).toHaveLength(2);
    });
    act(() => {
      focusManager.setFocused(false);
    });
    await act(() => vi.advanceTimersByTimeAsync(180_000));
    expect(requests).toHaveLength(2);
    act(() => {
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(requests).toHaveLength(3);
    });
  });

  it('keeps the list when a later reading fails, and says it may be out of date', async () => {
    serve();
    renderWithProviders(<Harness />);
    await table();
    server.use(
      http.get(`${API}/appointments`, () =>
        HttpResponse.json(
          { error: { status: 500, code: 'INTERNAL_ERROR', message: 'No', requestId: 'req-r' } },
          { status: 500 },
        ),
      ),
    );
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(
      await screen.findByText('We could not refresh this list. It may be out of date.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Appointments' })).toHaveTextContent(
      'Dela Cruz, Juan',
    );
  });
});
