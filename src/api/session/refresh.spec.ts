import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../errors.ts';
import { tokenStore } from './token-store.ts';
import { createRefresher } from './refresh.ts';

const ORIGIN = 'https://api.test';

afterEach(() => {
  tokenStore.clear();
});

function ok(token: string): Response {
  return Response.json({ data: { accessToken: token, expiresIn: 900 } });
}

/** A fake Web Locks API shared by "tabs": it runs one holder at a time, like the browser does. */
function fakeLocks() {
  const names: string[] = [];
  let queue: Promise<unknown> = Promise.resolve();
  const manager = {
    request: vi.fn((name: string, callback: () => Promise<unknown>) => {
      names.push(name);
      const run = queue.then(callback);
      queue = run.catch(() => undefined);
      return run;
    }),
  };
  return { manager: manager as unknown as LockManager, names };
}

describe('createRefresher', () => {
  it('posts to the refresh endpoint with the cookie, stores the new token and returns it', async () => {
    const fetchFn = vi.fn((...args: [RequestInfo | URL, RequestInit?]) =>
      Promise.resolve(args.length > 0 ? ok('tok-1') : ok('tok-1')),
    );
    const refresh = createRefresher({
      apiOrigin: ORIGIN,
      fetch: fetchFn,
      onToken: tokenStore.set,
    });
    expect(await refresh()).toBe('tok-1');
    expect(tokenStore.get()).toBe('tok-1');
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('https://api.test/api/v1/auth/refresh');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('sends a canonical X-Request-Id', async () => {
    const fetchFn = vi.fn((...args: [RequestInfo | URL, RequestInit?]) =>
      Promise.resolve(args.length > 0 ? ok('t') : ok('t')),
    );
    await createRefresher({
      apiOrigin: ORIGIN,
      fetch: fetchFn,
      onToken: () => undefined,
    })();
    const headers = new Headers(fetchFn.mock.calls[0]?.[1]?.headers);
    expect(headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('shares one request between concurrent callers (two refreshes with one cookie end the session)', async () => {
    let resolve!: (response: Response) => void;
    const fetchFn = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    const refresh = createRefresher({
      apiOrigin: ORIGIN,
      fetch: fetchFn,
      onToken: tokenStore.set,
    });
    const calls = Promise.all([refresh(), refresh(), refresh()]);
    resolve(ok('shared'));
    expect(await calls).toEqual(['shared', 'shared', 'shared']);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('runs under the Web Lock "dt-refresh", so other tabs wait their turn', async () => {
    const { manager, names } = fakeLocks();
    const refresh = createRefresher({
      apiOrigin: ORIGIN,
      fetch: () => Promise.resolve(ok('t')),
      locks: manager,
      onToken: () => undefined,
    });
    await refresh();
    expect(names).toEqual(['dt-refresh']);
  });

  it('two tabs refreshing at the same moment never overlap', async () => {
    const { manager } = fakeLocks();
    let running = 0;
    let highest = 0;
    const fetchFn = vi.fn(async () => {
      running += 1;
      highest = Math.max(highest, running);
      await new Promise((r) => setTimeout(r, 10));
      running -= 1;
      return ok('t');
    });
    const tabA = createRefresher({
      apiOrigin: ORIGIN,
      fetch: fetchFn,
      locks: manager,
      onToken: () => undefined,
    });
    const tabB = createRefresher({
      apiOrigin: ORIGIN,
      fetch: fetchFn,
      locks: manager,
      onToken: () => undefined,
    });
    await Promise.all([tabA(), tabB()]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(highest).toBe(1);
  });

  it('still works where the Web Locks API does not exist', async () => {
    const refresh = createRefresher({
      apiOrigin: ORIGIN,
      fetch: () => Promise.resolve(ok('t')),
      onToken: tokenStore.set,
    });
    expect(await refresh()).toBe('t');
  });

  it('a 401 means the session is over: rejects with an ApiError and leaves the token alone', async () => {
    tokenStore.set('old');
    const refresh = createRefresher({
      apiOrigin: ORIGIN,
      fetch: () =>
        Promise.resolve(
          Response.json(
            { error: { status: 401, code: 'UNAUTHENTICATED', message: 'x', requestId: 'r' } },
            { status: 401 },
          ),
        ),
      onToken: tokenStore.set,
    });
    await expect(refresh()).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(tokenStore.get()).toBe('old');
  });

  it('turns a network failure into NETWORK_ERROR', async () => {
    const refresh = createRefresher({
      apiOrigin: ORIGIN,
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
      onToken: () => undefined,
    });
    const failure = refresh();
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('a failed attempt does not block the next one', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(ok('back'));
    const refresh = createRefresher({
      apiOrigin: ORIGIN,
      fetch: fetchFn,
      onToken: tokenStore.set,
    });
    await expect(refresh()).rejects.toBeDefined();
    expect(await refresh()).toBe('back');
  });
});
