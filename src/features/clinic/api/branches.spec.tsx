import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';

import { branchTimeZone, useBranchTimeZone } from './branches.ts';

const API = 'http://localhost:3000/api/v1';

const branch = (timezone: string | null) => ({
  id: 'branch-1',
  tenantId: 'clinic-a',
  name: 'Main',
  address: null,
  phone: null,
  timezone,
  isActive: true,
  createdAt: '2026-11-27T00:00:00.000Z',
  updatedAt: '2026-11-27T00:00:00.000Z',
});

function serve({ timezone }: { timezone: string | null }) {
  server.use(
    http.get(`${API}/branches/:branchId`, ({ params }) =>
      params.branchId === 'branch-1'
        ? HttpResponse.json({ data: branch(timezone) })
        : HttpResponse.json(
            { error: { status: 404, code: 'NOT_FOUND', message: 'No', requestId: 'r' } },
            { status: 404 },
          ),
    ),
    http.get(`${API}/tenant`, () =>
      HttpResponse.json({ data: { id: 'clinic-a', timezone: 'Asia/Manila' } }),
    ),
  );
}

function run(branchId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useBranchTimeZone(branchId), { wrapper }) };
}

beforeEach(() => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'u', email: 'a@b.test', fullName: 'A' },
    memberships: [],
    activeTenantId: 'clinic-a',
    permissions: ['branches.read', 'tenant.read'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('branchTimeZone', () => {
  it('is the branch’s own zone, or the clinic’s when it has none', () => {
    expect(
      branchTimeZone({ branch: { timezone: 'Pacific/Honolulu' }, clinicZone: 'Asia/Manila' }),
    ).toBe('Pacific/Honolulu');
    expect(branchTimeZone({ branch: { timezone: null }, clinicZone: 'Asia/Manila' })).toBe(
      'Asia/Manila',
    );
  });

  it('is unknown while what decides it is unknown', () => {
    expect(branchTimeZone({ branch: undefined, clinicZone: 'Asia/Manila' })).toBeUndefined();
    expect(branchTimeZone({ branch: { timezone: null }, clinicZone: undefined })).toBeUndefined();
  });
});

describe('useBranchTimeZone', () => {
  it('gives the branch’s own zone', async () => {
    serve({ timezone: 'Pacific/Honolulu' });
    const { result } = run('branch-1');
    await waitFor(() => {
      expect(result.current).toBe('Pacific/Honolulu');
    });
  });

  it('falls back to the clinic’s zone', async () => {
    serve({ timezone: null });
    const { result } = run('branch-1');
    await waitFor(() => {
      expect(result.current).toBe('Asia/Manila');
    });
  });

  it('gives none for an unknown branch, never the clinic’s', async () => {
    serve({ timezone: null });
    const { result, client } = run('branch-9');
    await waitFor(() => {
      expect(client.isFetching()).toBe(0);
    });
    expect(result.current).toBeUndefined();
  });

  it('asks nothing while no branch is chosen', () => {
    // An unexpected request fails the test.
    server.use(
      http.get(`${API}/tenant`, () =>
        HttpResponse.json({ data: { id: 'clinic-a', timezone: 'Asia/Manila' } }),
      ),
    );
    const { result } = run('');
    expect(result.current).toBeUndefined();
  });
});
