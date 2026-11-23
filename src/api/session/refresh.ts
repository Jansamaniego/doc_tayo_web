import { getEnv } from '@/config/env.ts';
import { z } from '@/lib/zod.ts';

import { ApiError, networkError, parseErrorResponse } from '../errors.ts';
import { newRequestId } from '../request-id.ts';
import { createSingleFlight } from './single-flight.ts';
import { tokenStore } from './token-store.ts';

const LOCK_NAME = 'dt-refresh';

const envelope = z.object({ data: z.object({ accessToken: z.string().min(1) }) });

export interface RefresherOptions {
  /** Scheme, host and port only. */
  apiOrigin: string;
  fetch?: typeof fetch;
  /** The Web Locks API: tabs refresh one at a time, so no two refreshes use the same cookie. */
  locks?: LockManager | undefined;
  onToken: (token: string) => void;
}

/**
 * Gets a new access token from the refresh cookie. Two refreshes with the same cookie look like a
 * stolen token to the server and end the session everywhere, so refreshing is serialised twice
 * (docs/frontend-integration.md §4): within this tab by one shared promise, and across tabs by a
 * Web Lock. The refresh token itself is an httpOnly cookie this code never sees.
 */
export function createRefresher({
  apiOrigin,
  fetch: fetchFn,
  locks,
  onToken,
}: RefresherOptions): () => Promise<string> {
  const send: typeof fetch = fetchFn ?? ((input, init) => fetch(input, init));

  async function attempt(): Promise<string> {
    let response: Response;
    try {
      response = await send(`${apiOrigin}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Request-Id': newRequestId() },
      });
    } catch (cause) {
      throw networkError(cause);
    }
    if (!response.ok) throw await parseErrorResponse(response);
    const parsed = envelope.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) {
      throw new ApiError({
        status: response.status,
        code: 'INTERNAL_ERROR',
        message: 'Unexpected refresh answer.',
        details: [],
      });
    }
    onToken(parsed.data.data.accessToken);
    return parsed.data.data.accessToken;
  }

  return createSingleFlight(async () =>
    locks ? await locks.request(LOCK_NAME, attempt) : await attempt(),
  );
}

let shared: (() => Promise<string>) | undefined;

/** The app's refresher: one per tab, coordinated with the other tabs through the Web Lock. */
export function refreshAccessToken(): Promise<string> {
  shared ??= createRefresher({
    apiOrigin: getEnv().apiOrigin,
    locks: typeof navigator === 'undefined' ? undefined : navigator.locks,
    onToken: tokenStore.set,
  });
  return shared();
}
