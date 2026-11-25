import createClient, { type Middleware } from 'openapi-fetch';

import { getEnv } from '@/config/env.ts';

import { ApiError, networkError, parseErrorResponse } from './errors.ts';
import { newRequestId } from './request-id.ts';
import type { paths } from './schema';
import { refreshAccessToken } from './session/refresh.ts';
import { sessionStore } from './session/session-store.ts';
import { tokenStore } from './session/token-store.ts';

export interface CreateApiClientOptions {
  /** Scheme, host and port only: the generated paths already start with /api/v1. */
  apiOrigin: string;
  getAccessToken: () => string | null;
  /** The clinic the person is working in, sent as `X-Expected-Tenant-Id` so another one is refused. */
  getActiveTenantId?: () => string | null;
  fetch?: typeof fetch;
  /** Gets a new access token. Must be single-flight (see session/refresh.ts). */
  refresh?: () => Promise<string>;
  /** The server says the session is over (the refresh was refused, or UNAUTHENTICATED). */
  onSessionEnded?: () => void;
}

const EXPECTED_TENANT_HEADER = 'X-Expected-Tenant-Id';

/**
 * Headers a single request may need: `headers: requestHeaders({ ... })`.
 * `tenantId` is the clinic a form was OPENED in: it replaces the active one, so a clinic switched in
 * another tab cannot receive what was typed for this one (`409 TENANT_MISMATCH`).
 * `idempotencyKey` makes a creating request safe to repeat (see idempotency.ts).
 */
export function requestHeaders({
  tenantId,
  idempotencyKey,
}: {
  tenantId?: string | undefined;
  idempotencyKey?: string | undefined;
}): Record<string, string> {
  return {
    ...(tenantId && { [EXPECTED_TENANT_HEADER]: tenantId }),
    ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
  };
}

function isAuthRoute(request: Request): boolean {
  return new URL(request.url).pathname.startsWith('/api/v1/auth/');
}

function sessionExpired(): ApiError {
  return new ApiError({
    status: 401,
    code: 'UNAUTHENTICATED',
    message: 'Please sign in to continue.',
    details: [],
  });
}

/**
 * The only way to call the API. Every failure is thrown as an ApiError. An expired access token is
 * refreshed once and the request is retried once (docs/frontend-integration.md §4); any other 401
 * means the session is over.
 */
export function createApiClient({
  apiOrigin,
  getAccessToken,
  getActiveTenantId,
  fetch: fetchFn,
  refresh,
  onSessionEnded,
}: CreateApiClientOptions) {
  const client = createClient<paths>({
    baseUrl: apiOrigin,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });
  const send: typeof fetch = fetchFn ?? ((input, init) => fetch(input, init));
  // A copy of each outgoing request, so a request whose token expired can be sent again with its body.
  const templates = new WeakMap<Request, Request>();

  async function retryWithNewToken(request: Request): Promise<Response> {
    const template = templates.get(request);
    if (!template || !refresh) throw sessionExpired();
    let token: string;
    try {
      token = await refresh();
    } catch (error) {
      const status = (error as { status?: unknown }).status;
      // Refused (401/403): the session is over. Offline or a server error: it may still be fine.
      if (status !== 401 && status !== 403) throw error;
      onSessionEnded?.();
      throw sessionExpired();
    }
    const headers = new Headers(template.headers);
    headers.set('Authorization', `Bearer ${token}`);
    let retried: Response;
    try {
      retried = await send(new Request(template, { headers }));
    } catch (cause) {
      throw networkError(cause);
    }
    if (!retried.ok) {
      const error = await parseErrorResponse(retried);
      if (error.code === 'UNAUTHENTICATED') onSessionEnded?.();
      throw error;
    }
    return retried;
  }

  const middleware: Middleware = {
    onRequest({ request }) {
      const headers = new Headers(request.headers);
      headers.set('X-Request-Id', newRequestId());
      const token = getAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const tenantId = getActiveTenantId?.();
      // Never sent empty; a request that already names a clinic (a form's) keeps it.
      if (tenantId && !headers.has(EXPECTED_TENANT_HEADER)) {
        headers.set(EXPECTED_TENANT_HEADER, tenantId);
      }
      // login, refresh and logout need the httpOnly refresh cookie.
      const outgoing = new Request(request, {
        headers,
        ...(isAuthRoute(request) && { credentials: 'include' }),
      });
      templates.set(outgoing, outgoing.clone());
      return outgoing;
    },
    async onResponse({ request, response }) {
      if (response.ok) return undefined;
      const error = await parseErrorResponse(response.clone());
      if (response.status === 401 && !isAuthRoute(request)) {
        if (error.code === 'ACCESS_TOKEN_EXPIRED') return retryWithNewToken(request);
        if (error.code === 'UNAUTHENTICATED') onSessionEnded?.();
      }
      throw error;
    },
    onError({ error }) {
      return error instanceof ApiError ? error : networkError(error);
    },
  };
  client.use(middleware);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

let shared: ApiClient | undefined;
let sessionEndedHandler: (() => void) | undefined;

/** The session module registers here, so the client can tell it the server ended the session. */
export function setSessionEndedHandler(handler: () => void): void {
  sessionEndedHandler = handler;
}

export function getApiClient(): ApiClient {
  shared ??= createApiClient({
    apiOrigin: getEnv().apiOrigin,
    getAccessToken: () => tokenStore.get(),
    getActiveTenantId: () => {
      const session = sessionStore.get();
      return session.status === 'signed-in' ? session.activeTenantId : null;
    },
    refresh: refreshAccessToken,
    onSessionEnded: () => {
      sessionEndedHandler?.();
    },
  });
  return shared;
}
