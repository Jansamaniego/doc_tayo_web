import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';

import { useFreshService, useService, useServices, type ServiceFilters } from './services.ts';

const API = 'http://localhost:3000/api/v1';
const service = (name: string) => ({
  id: 'service-1',
  name,
  description: null,
  defaultDurationMinutes: 30,
  price: '500.00',
  currency: 'PHP',
  isActive: true,
  createdAt: '2026-11-27T00:00:00.000Z',
  updatedAt: '2026-11-27T00:00:00.000Z',
});

function signInTo(activeTenantId: string) {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'u', email: 'a@b.test', fullName: 'A' },
    memberships: [],
    activeTenantId,
    permissions: ['services.read'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
}

/** The list of whichever clinic is active when asked: each clinic has its own service. */
function serveList() {
  const requests: URL[] = [];
  server.use(
    http.get(`${API}/services`, ({ request }) => {
      requests.push(new URL(request.url));
      const state = sessionStore.get();
      const tenant = state.status === 'signed-in' ? state.activeTenantId : null;
      return HttpResponse.json({
        data: [service(`Service of ${tenant ?? 'nobody'}`)],
        meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
      });
    }),
  );
  return requests;
}

function serveOne() {
  let asked = 0;
  server.use(
    http.get(`${API}/services/:serviceId`, ({ params }) => {
      asked += 1;
      return HttpResponse.json({
        data: { ...service(`Answer ${asked}`), id: String(params.serviceId) },
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

function runList(filters: ServiceFilters = {}) {
  const client = newClient();
  return {
    client,
    ...renderHook((props: ServiceFilters) => useServices(props), {
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

describe('useServices', () => {
  it('sends the page and page size, and nothing about inactive services unless asked', async () => {
    const requests = serveList();
    const { result } = runList({ page: 2, pageSize: 50, includeInactive: false });
    await waitFor(() => {
      expect(result.current.data?.data).toHaveLength(1);
    });
    expect(requests[0]?.searchParams.get('page')).toBe('2');
    expect(requests[0]?.searchParams.get('pageSize')).toBe('50');
    expect(requests[0]?.searchParams.has('includeInactive')).toBe(false);
  });

  it('asks for inactive services when told to', async () => {
    const requests = serveList();
    const { result } = runList({ includeInactive: true });
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(requests[0]?.searchParams.get('includeInactive')).toBe('true');
    expect(requests[0]?.searchParams.has('page')).toBe(false);
    expect(requests[0]?.searchParams.has('pageSize')).toBe(false);
  });

  it('keys the answer by clinic and filters', async () => {
    serveList();
    const { result, client } = runList({ page: 1 });
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(
      client.getQueryCache().findAll({ queryKey: ['clinic-a', 'services', 'list'] }),
    ).toHaveLength(1);
  });

  it('keeps the previous page on screen while the next one loads', async () => {
    serveList();
    const { result, rerender } = runList({ page: 1 });
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    rerender({ page: 2 });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.data[0]?.name).toBe('Service of clinic-a');
  });

  it("never shows the other clinic's services after a switch", async () => {
    serveList();
    const { result } = runList({ page: 1 });
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    act(() => {
      signInTo('clinic-b');
    });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => {
      expect(result.current.data?.data[0]?.name).toBe('Service of clinic-b');
    });
  });

  it('asks nothing without an active clinic', () => {
    sessionStore.set({ status: 'signed-out' });
    const { result } = runList();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('reports a failure as an API error', async () => {
    server.use(
      http.get(`${API}/services`, () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'No.', requestId: 'r1' } },
          { status: 403 },
        ),
      ),
    );
    const { result } = runList();
    await waitFor(() => {
      expect(result.current.error).toMatchObject({ code: 'FORBIDDEN', requestId: 'r1' });
    });
  });
});

describe('useService and useFreshService (one service)', () => {
  it('reads one service, keyed by clinic', async () => {
    serveOne();
    const client = newClient();
    const { result } = renderHook(() => useService('service-9'), { wrapper: wrapperFor(client) });
    await waitFor(() => {
      expect(result.current.data?.id).toBe('service-9');
    });
    expect(client.getQueryData(['clinic-a', 'services', 'detail', 'service-9'])).toBeDefined();
  });

  it('always asks again for a form, and says when the answer is new', async () => {
    const asked = serveOne();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    client.setQueryData(['clinic-a', 'services', 'detail', 'service-1'], service('Old name'));

    const { result } = renderHook(() => useFreshService('service-1'), {
      wrapper: wrapperFor(client),
    });
    expect(result.current.isFetchedAfterMount).toBe(false);
    await waitFor(() => {
      expect(result.current.isFetchedAfterMount).toBe(true);
    });
    expect(result.current.data?.name).toBe('Answer 1');
    expect(asked()).toBe(1);
  });
});
