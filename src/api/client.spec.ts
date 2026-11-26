import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw/server.ts';

import { createApiClient, getApiClient, requestHeaders } from './client.ts';
import { ApiError } from './errors.ts';
import { sessionStore } from './session/session-store.ts';

const ORIGIN = 'https://api.test';
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function setup({
  token = null as string | null,
  respond = () => Response.json({ data: {} }),
}: { token?: string | null; respond?: (request: Request) => Response } = {}) {
  const requests: Request[] = [];
  const fetchFn = vi.fn((input: Request) => {
    requests.push(input);
    return Promise.resolve(respond(input));
  });
  const client = createApiClient({
    apiOrigin: ORIGIN,
    getAccessToken: () => token,
    fetch: fetchFn as unknown as typeof fetch,
  });
  return { client, requests, fetchFn };
}

describe('createApiClient', () => {
  it('sends a canonical UUID X-Request-Id on every request', async () => {
    const { client, requests } = setup();
    await client.GET('/api/v1/tenant');
    await client.GET('/api/v1/tenant');
    expect(requests[0]?.headers.get('x-request-id')).toMatch(UUID_V7);
    expect(requests[1]?.headers.get('x-request-id')).toMatch(UUID_V7);
    expect(requests[0]?.headers.get('x-request-id')).not.toBe(
      requests[1]?.headers.get('x-request-id'),
    );
  });

  it('adds the bearer token when one exists', async () => {
    const { client, requests } = setup({ token: 'tok-123' });
    await client.GET('/api/v1/tenant');
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer tok-123');
  });

  it('sends no Authorization header when there is no token', async () => {
    const { client, requests } = setup({ token: null });
    await client.GET('/api/v1/tenant');
    expect(requests[0]?.headers.has('authorization')).toBe(false);
  });

  it('sends cookies (credentials: include) on /auth/* only', async () => {
    const { client, requests } = setup();
    await client.POST('/api/v1/auth/login', { body: { email: 'a@b.test', password: 'x' } });
    await client.GET('/api/v1/tenant');
    expect(requests[0]?.credentials).toBe('include');
    expect(requests[1]?.credentials).not.toBe('include');
  });

  it('requests the right URL under the API origin', async () => {
    const { client, requests } = setup();
    await client.GET('/api/health');
    expect(requests[0]?.url).toBe('https://api.test/api/health');
  });

  it('returns the data of a successful response', async () => {
    const { client } = setup({ respond: () => Response.json({ status: 'ok' }) });
    const result = await client.GET('/api/health');
    expect(result.data).toEqual({ status: 'ok' });
  });

  it('throws an ApiError built from a non-2xx response', async () => {
    const { client } = setup({
      respond: () =>
        Response.json(
          { error: { status: 403, code: 'TENANT_NOT_SELECTED', message: 'm', requestId: 'req-9' } },
          { status: 403 },
        ),
    });
    const failure = client.GET('/api/v1/tenant');
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({
      status: 403,
      code: 'TENANT_NOT_SELECTED',
      requestId: 'req-9',
    });
  });

  it('reads Retry-After into the error on 429', async () => {
    const { client } = setup({
      respond: () =>
        Response.json(
          { error: { status: 429, code: 'RATE_LIMITED', message: 'm', requestId: 'r' } },
          { status: 429, headers: { 'retry-after': '30' } },
        ),
    });
    await expect(client.GET('/api/v1/tenant')).rejects.toMatchObject({ retryAfterSeconds: 30 });
  });

  it('turns a network failure into a NETWORK_ERROR ApiError', async () => {
    const client = createApiClient({
      apiOrigin: ORIGIN,
      getAccessToken: () => null,
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    await expect(client.GET('/api/v1/tenant')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });
});

describe('the clinic check header (X-Expected-Tenant-Id)', () => {
  const clientIn = (activeTenant: string | null) => {
    const requests: Request[] = [];
    const client = createApiClient({
      apiOrigin: ORIGIN,
      getAccessToken: () => 'tok',
      getActiveTenantId: () => activeTenant,
      fetch: ((input: Request) => {
        requests.push(input);
        return Promise.resolve(Response.json({ data: {} }));
      }) as unknown as typeof fetch,
    });
    return { client, requests };
  };

  it('names the active clinic on every request', async () => {
    const { client, requests } = clientIn('clinic-a');
    await client.GET('/api/v1/tenant');
    await client.POST('/api/v1/branches', { body: { name: 'x', isActive: true } });
    expect(requests.map((request) => request.headers.get('x-expected-tenant-id'))).toEqual([
      'clinic-a',
      'clinic-a',
    ]);
  });

  it.each([null, ''])(
    'is left out, never sent empty, when there is no clinic (%j)',
    async (none) => {
      const { client, requests } = clientIn(none);
      await client.GET('/api/v1/tenant');
      expect(requests[0]?.headers.has('x-expected-tenant-id')).toBe(false);
    },
  );

  it('names the clinic a form was opened in when the caller says so, whatever is active now', async () => {
    const { client, requests } = clientIn('clinic-b');
    await client.POST('/api/v1/branches', {
      body: { name: 'x', isActive: true },
      headers: requestHeaders({ tenantId: 'clinic-a' }),
    });
    expect(requests[0]?.headers.get('x-expected-tenant-id')).toBe('clinic-a');
  });

  it('sends an Idempotency-Key only when one is given', async () => {
    const { client, requests } = clientIn('clinic-a');
    await client.POST('/api/v1/branches', { body: { name: 'x', isActive: true } });
    await client.POST('/api/v1/branches', {
      body: { name: 'x', isActive: true },
      headers: requestHeaders({ idempotencyKey: 'key-1' }),
    });
    expect(requests[0]?.headers.has('idempotency-key')).toBe(false);
    expect(requests[1]?.headers.get('idempotency-key')).toBe('key-1');
    expect(requests[1]?.headers.get('x-expected-tenant-id')).toBe('clinic-a');
  });

  it('keeps the clinic and the key when the request is sent again after the access token expired', async () => {
    const requests: Request[] = [];
    let active = 'clinic-a';
    const client = createApiClient({
      apiOrigin: ORIGIN,
      getAccessToken: () => 'old',
      getActiveTenantId: () => active,
      refresh: () => {
        // Another tab switched clinics while the token was being renewed.
        active = 'clinic-b';
        return Promise.resolve('new');
      },
      fetch: ((input: Request) => {
        requests.push(input);
        return Promise.resolve(
          requests.length === 1
            ? Response.json(
                {
                  error: {
                    status: 401,
                    code: 'ACCESS_TOKEN_EXPIRED',
                    message: 'm',
                    requestId: 'r',
                  },
                },
                { status: 401 },
              )
            : Response.json({ data: {} }),
        );
      }) as unknown as typeof fetch,
    });
    await client.POST('/api/v1/branches', {
      body: { name: 'x', isActive: true },
      headers: requestHeaders({ idempotencyKey: 'key-9' }),
    });
    expect(requests).toHaveLength(2);
    expect(requests[1]?.headers.get('authorization')).toBe('Bearer new');
    expect(requests[1]?.headers.get('idempotency-key')).toBe('key-9');
    expect(requests[1]?.headers.get('x-expected-tenant-id')).toBe('clinic-a');
  });
});

describe('getApiClient (the app’s client)', () => {
  afterEach(() => {
    sessionStore.set({ status: 'signed-out' });
  });

  it('names the clinic of the signed-in session', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get('http://localhost:3000/api/v1/tenant', ({ request }) => {
        seen.push(request.headers.get('x-expected-tenant-id'));
        return HttpResponse.json({ data: {} });
      }),
    );
    sessionStore.set({
      status: 'signed-in',
      user: { id: 'u', email: 'a@b.test', fullName: 'A' },
      memberships: [],
      activeTenantId: 'clinic-z',
      permissions: [],
      platformRole: 'none',
      practitionerProfileId: null,
    });
    await getApiClient().GET('/api/v1/tenant');
    sessionStore.set({ status: 'signed-out' });
    await getApiClient().GET('/api/v1/tenant');
    expect(seen).toEqual(['clinic-z', null]);
  });
});
