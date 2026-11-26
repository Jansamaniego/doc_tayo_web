import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';

import { useDirectory, type DirectoryFilters } from './directory.ts';

const API = 'http://localhost:3000/api/v1';
const entry = (n: number) => ({
  membershipId: `m${n}`,
  fullName: `Person ${n}`,
  jobTitle: null,
  roles: [],
  practitioner: null,
});

/** A directory of `total` people, served in the pages asked for. */
function serve(total: number) {
  const requests: URL[] = [];
  server.use(
    http.get(`${API}/directory`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const all = Array.from({ length: total }, (_, index) => entry(index + 1));
      return HttpResponse.json({
        data: all.slice((page - 1) * pageSize, page * pageSize),
        meta: { page, pageSize, totalItems: total, totalPages: Math.ceil(total / pageSize) },
      });
    }),
  );
  return requests;
}

function run(filters: DirectoryFilters = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useDirectory(filters), { wrapper }) };
}

beforeEach(() => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'u', email: 'a@b.test', fullName: 'A' },
    memberships: [],
    activeTenantId: 'clinic-a',
    permissions: ['directory.read'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('useDirectory (the whole directory: the API has no search)', () => {
  it('asks once, for pages of 100, when everyone fits', async () => {
    const requests = serve(12);
    const { result } = run();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(12);
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.searchParams.get('pageSize')).toBe('100');
    expect(requests[0]?.searchParams.get('page')).toBe('1');
  });

  it('reads every page until it has everyone, in order', async () => {
    const requests = serve(250);
    const { result } = run();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(250);
    });
    expect(requests.map((url) => url.searchParams.get('page'))).toEqual(['1', '2', '3']);
    expect(result.current.data?.[200]?.membershipId).toBe('m201');
  });

  it('handles an empty clinic', async () => {
    const requests = serve(0);
    const { result } = run();
    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
    expect(requests).toHaveLength(1);
  });

  it('sends the filters, and keys the answer by clinic', async () => {
    const requests = serve(1);
    const { result, client } = run({ practitionersOnly: true, branchId: 'branch-1' });
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    expect(requests[0]?.searchParams.get('practitionersOnly')).toBe('true');
    expect(requests[0]?.searchParams.get('branchId')).toBe('branch-1');
    expect(client.getQueryCache().findAll({ queryKey: ['clinic-a', 'directory'] })).toHaveLength(1);
  });

  it('leaves unused filters out of the request', async () => {
    const requests = serve(1);
    const { result } = run({ practitionersOnly: false });
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    expect(requests[0]?.searchParams.has('practitionersOnly')).toBe(false);
    expect(requests[0]?.searchParams.has('branchId')).toBe(false);
  });

  it('keeps no names in memory once no screen uses them (never cached)', async () => {
    serve(1);
    const { result, client, unmount } = run();
    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    unmount();
    await waitFor(() => {
      expect(client.getQueryCache().findAll({ queryKey: ['clinic-a', 'directory'] })).toHaveLength(
        0,
      );
    });
  });
});
