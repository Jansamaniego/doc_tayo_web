import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';

import {
  useAppointment,
  useDayAppointments,
  useFreshAppointment,
  type DayFilters,
} from './appointments.ts';

const API = 'http://localhost:3000/api/v1';
const DAY: DayFilters = { branchId: 'branch-1', date: '2026-12-07' };

const appointment = (id: string, reason: string | null = null) => ({
  id,
  kind: 'scheduled',
  status: 'scheduled',
  branchId: 'branch-1',
  patient: { id: 'p1', patientNumber: 'P-000001', firstName: 'Juan', lastName: 'Dela Cruz' },
  practitioner: { membershipId: 'm1', profileId: 'pr1', displayName: 'Dr. Dan Doctor, MD' },
  service: null,
  startsAt: '2026-12-07T01:00:00.000Z',
  endsAt: '2026-12-07T01:30:00.000Z',
  reason,
  checkedInAt: null,
  cancelledAt: null,
  cancelReason: null,
  version: 1,
  createdAt: '2026-12-06T23:40:12.345Z',
  updatedAt: '2026-12-06T23:40:12.345Z',
});

function signInTo(activeTenantId: string) {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'u', email: 'a@b.test', fullName: 'A' },
    memberships: [],
    activeTenantId,
    permissions: ['appointments.read'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
}

/** A day of `total` appointments of the clinic that is active when asked, in the pages asked for. */
function serveDay(total: number) {
  const requests: URL[] = [];
  server.use(
    http.get(`${API}/appointments`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const state = sessionStore.get();
      const tenant = state.status === 'signed-in' ? state.activeTenantId : 'nobody';
      const all = Array.from({ length: total }, (_, index) =>
        appointment(`${tenant ?? 'nobody'}-${index + 1}`),
      );
      return HttpResponse.json({
        data: all.slice((page - 1) * pageSize, page * pageSize),
        meta: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) },
      });
    }),
  );
  return requests;
}

function serveOne() {
  let asked = 0;
  server.use(
    http.get(`${API}/appointments/:appointmentId`, ({ params }) => {
      asked += 1;
      return HttpResponse.json({
        data: appointment(String(params.appointmentId), `Answer ${asked}`),
      });
    }),
  );
  return () => asked;
}

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function runDay(filters: DayFilters = DAY) {
  const client = newClient();
  return {
    client,
    ...renderHook((props: DayFilters) => useDayAppointments(props), {
      wrapper: wrapperFor(client),
      initialProps: filters,
    }),
  };
}

beforeEach(() => {
  signInTo('clinic-a');
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('useDayAppointments (the whole day, every page)', () => {
  it('asks once for a day of up to 100, with the branch and the day', async () => {
    const requests = serveDay(3);
    const { result } = runDay();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(3);
    });
    expect(requests).toHaveLength(1);
    expect(Object.fromEntries(requests[0]?.searchParams ?? [])).toEqual({
      branchId: 'branch-1',
      date: '2026-12-07',
      page: '1',
      pageSize: '100',
    });
  });

  it('reads pages of 100 until the last, keeping the API’s order', async () => {
    const requests = serveDay(201);
    const { result } = runDay();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(201);
    });
    expect(requests.map((url) => url.searchParams.get('page'))).toEqual(['1', '2', '3']);
    expect(result.current.data?.map((item) => item.id).slice(98, 102)).toEqual([
      'clinic-a-99',
      'clinic-a-100',
      'clinic-a-101',
      'clinic-a-102',
    ]);
  });

  it('shows an empty day', async () => {
    serveDay(0);
    const { result } = runDay();
    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
  });

  it('sends the practitioner and the statuses only when set', async () => {
    const requests = serveDay(1);
    const { result } = runDay({
      ...DAY,
      practitionerMembershipId: 'm1',
      status: 'scheduled,checked_in',
    });
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(requests[0]?.searchParams.get('practitionerMembershipId')).toBe('m1');
    expect(requests[0]?.searchParams.get('status')).toBe('scheduled,checked_in');
  });

  it('keys the answer by clinic, branch, day, practitioner and status', async () => {
    serveDay(1);
    const filters = { ...DAY, practitionerMembershipId: 'm1', status: 'checked_in' };
    const { result, client } = runDay(filters);
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(client.getQueryCache().getAll()[0]?.queryKey).toEqual([
      'clinic-a',
      'appointments',
      'day',
      filters,
    ]);
  });

  it('does not show the previous day while another loads', async () => {
    serveDay(1);
    const { result, rerender } = runDay();
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    rerender({ ...DAY, date: '2026-12-08' });
    expect(result.current.data).toBeUndefined();
  });

  it.each([
    { branchId: '', date: '2026-12-07' },
    { branchId: 'branch-1', date: '' },
  ])('asks nothing without a branch and a day (%o)', (filters) => {
    // An unexpected request fails the test.
    const { result } = runDay(filters);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('never shows the other clinic’s appointments after a switch', async () => {
    serveDay(1);
    const { result } = runDay();
    await waitFor(() => {
      expect(result.current.data?.[0]?.id).toBe('clinic-a-1');
    });
    act(() => {
      signInTo('clinic-b');
    });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => {
      expect(result.current.data?.[0]?.id).toBe('clinic-b-1');
    });
  });

  it('keeps nothing once no screen uses it (the answers are never cached)', async () => {
    serveDay(1);
    const { result, client, unmount } = runDay();
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    unmount();
    await waitFor(() => {
      expect(client.getQueryCache().getAll()).toHaveLength(0);
    });
  });

  it('fails as a whole when a later page fails: never half a day', async () => {
    serveDay(150);
    server.use(
      http.get(`${API}/appointments`, ({ request }) =>
        new URL(request.url).searchParams.get('page') === '1'
          ? HttpResponse.json({
              data: [appointment('first')],
              meta: { page: 1, pageSize: 100, totalItems: 150, totalPages: 2 },
            })
          : HttpResponse.json(
              { error: { status: 500, code: 'INTERNAL_ERROR', message: 'No', requestId: 'r' } },
              { status: 500 },
            ),
      ),
    );
    const { result } = runDay();
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });
});

describe('useAppointment', () => {
  it('reads one appointment, keyed by clinic and id, and keeps nothing afterwards', async () => {
    serveOne();
    const client = newClient();
    const { result, unmount } = renderHook(() => useAppointment('a1'), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => {
      expect(result.current.data?.id).toBe('a1');
    });
    expect(client.getQueryCache().getAll()[0]?.queryKey).toEqual([
      'clinic-a',
      'appointments',
      'detail',
      'a1',
    ]);
    unmount();
    await waitFor(() => {
      expect(client.getQueryCache().getAll()).toHaveLength(0);
    });
  });
});

describe('useFreshAppointment (for a form that changes what it reads)', () => {
  it('asks again even when a copy is cached', async () => {
    const asked = serveOne();
    const client = newClient();
    const wrapper = wrapperFor(client);
    const first = renderHook(() => useAppointment('a1'), { wrapper });
    await waitFor(() => {
      expect(first.result.current.data).toBeDefined();
    });
    client.setQueryDefaults(['clinic-a'], { staleTime: 60_000 });
    const second = renderHook(() => useFreshAppointment('a1'), { wrapper });
    await waitFor(() => {
      expect(second.result.current.isFetchedAfterMount).toBe(true);
    });
    expect(asked()).toBe(2);
    expect(second.result.current.data?.reason).toBe('Answer 2');
  });
});
