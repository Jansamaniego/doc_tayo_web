import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from './client.ts';
import { createSingleFlight } from './session/single-flight.ts';

const ORIGIN = 'https://api.test';
const expired = () =>
  Response.json(
    { error: { status: 401, code: 'ACCESS_TOKEN_EXPIRED', message: 'x', requestId: 'r' } },
    { status: 401 },
  );
const unauthenticated = () =>
  Response.json(
    { error: { status: 401, code: 'UNAUTHENTICATED', message: 'x', requestId: 'r' } },
    { status: 401 },
  );
const ok = (data: unknown = {}) => Response.json({ data });

function setup(options: {
  respond: (request: Request) => Response | Promise<Response>;
  refresh?: () => Promise<string>;
}) {
  let token = 'old';
  const requests: Request[] = [];
  const onSessionEnded = vi.fn();
  const refresh = vi.fn(
    options.refresh ??
      (() => {
        token = 'new';
        return Promise.resolve('new');
      }),
  );
  const fetchFn = vi.fn(async (input: Request) => {
    requests.push(input);
    return options.respond(input);
  });
  const client = createApiClient({
    apiOrigin: ORIGIN,
    getAccessToken: () => token,
    fetch: fetchFn as unknown as typeof fetch,
    refresh,
    onSessionEnded,
  });
  return { client, requests, refresh, onSessionEnded, fetchFn };
}

const byToken = (request: Request) =>
  request.headers.get('authorization') === 'Bearer new' ? ok({ id: 't' }) : expired();

describe('expired access token (docs/frontend-integration.md §4)', () => {
  it('refreshes once, retries the request with the new token, and returns its answer', async () => {
    const { client, requests, refresh } = setup({ respond: byToken });
    const result = await client.GET('/api/v1/tenant');
    expect(result.data).toEqual({ data: { id: 't' } });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer old');
    expect(requests[1]?.headers.get('authorization')).toBe('Bearer new');
  });

  it('retries only once: a second expiry is an error, not a loop', async () => {
    const { client, refresh, fetchFn } = setup({ respond: () => expired() });
    await expect(client.GET('/api/v1/tenant')).rejects.toMatchObject({
      code: 'ACCESS_TOKEN_EXPIRED',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('sends the same body again when it retries a write', async () => {
    const { client, requests } = setup({ respond: byToken });
    await client.PATCH('/api/v1/tenant', { body: { name: 'Sunrise' } });
    expect(await requests[0]?.clone().text()).toBe('{"name":"Sunrise"}');
    expect(await requests[1]?.clone().text()).toBe('{"name":"Sunrise"}');
    expect(requests[1]?.method).toBe('PATCH');
  });

  it('lets several expired requests wait for one refresh (one cookie, one refresh)', async () => {
    let calls = 0;
    const sharedRefresh = createSingleFlight(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'new';
    });
    const { client } = setup({ respond: byToken, refresh: sharedRefresh });
    const results = await Promise.all([
      client.GET('/api/v1/tenant'),
      client.GET('/api/v1/branches'),
      client.GET('/api/v1/me'),
    ]);
    expect(results.every((result) => result.response.ok)).toBe(true);
    expect(calls).toBe(1);
  });

  it('ends the session when the refresh itself is refused (401): the person must sign in again', async () => {
    const { client, onSessionEnded } = setup({
      respond: () => expired(),
      refresh: () =>
        Promise.reject(Object.assign(new Error('x'), { status: 401, code: 'UNAUTHENTICATED' })),
    });
    await expect(client.GET('/api/v1/tenant')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
  });

  it('does NOT end the session when the refresh failed only because we are offline', async () => {
    const { client, onSessionEnded } = setup({
      respond: () => expired(),
      refresh: () =>
        Promise.reject(Object.assign(new Error('offline'), { status: 0, code: 'NETWORK_ERROR' })),
    });
    await expect(client.GET('/api/v1/tenant')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(onSessionEnded).not.toHaveBeenCalled();
  });
});

describe('other 401s and the sign-in routes', () => {
  it('UNAUTHENTICATED means the session is over: no refresh, the session ends', async () => {
    const { client, refresh, onSessionEnded } = setup({ respond: () => unauthenticated() });
    await expect(client.GET('/api/v1/me')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(refresh).not.toHaveBeenCalled();
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
  });

  it('a wrong password on sign-in is a plain error: it never refreshes or ends a session', async () => {
    const { client, refresh, onSessionEnded } = setup({
      respond: () =>
        Response.json(
          { error: { status: 401, code: 'INVALID_CREDENTIALS', message: 'x', requestId: 'r' } },
          { status: 401 },
        ),
    });
    await expect(
      client.POST('/api/v1/auth/login', { body: { email: 'a@b.test', password: 'x' } }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(refresh).not.toHaveBeenCalled();
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  it('an expired token on /auth/* is never retried (logout with an old token just fails)', async () => {
    const { client, refresh } = setup({ respond: () => expired() });
    await expect(client.POST('/api/v1/auth/logout')).rejects.toMatchObject({
      code: 'ACCESS_TOKEN_EXPIRED',
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('other errors (403, 404, 500) pass straight through', async () => {
    for (const status of [403, 404, 500]) {
      const { client, refresh, onSessionEnded } = setup({
        respond: () =>
          Response.json(
            { error: { status, code: 'FORBIDDEN', message: 'x', requestId: 'r' } },
            { status },
          ),
      });
      await expect(client.GET('/api/v1/tenant')).rejects.toMatchObject({ status });
      expect(refresh).not.toHaveBeenCalled();
      expect(onSessionEnded).not.toHaveBeenCalled();
    }
  });
});
