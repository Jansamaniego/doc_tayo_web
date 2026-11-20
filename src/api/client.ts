import createClient, { type Middleware } from 'openapi-fetch';

import { getEnv } from '@/config/env.ts';

import { networkError, parseErrorResponse } from './errors.ts';
import { newRequestId } from './request-id.ts';
import type { paths } from './schema';
import { tokenStore } from './session/token-store.ts';

export interface CreateApiClientOptions {
  /** Scheme, host and port only: the generated paths already start with /api/v1. */
  apiOrigin: string;
  getAccessToken: () => string | null;
  fetch?: typeof fetch;
}

function isAuthRoute(request: Request): boolean {
  return new URL(request.url).pathname.startsWith('/api/v1/auth/');
}

/**
 * The only way to call the API. Every failure is thrown as an ApiError.
 * Phase 3 adds the expired-token refresh and retry to this middleware.
 */
export function createApiClient({
  apiOrigin,
  getAccessToken,
  fetch: fetchFn,
}: CreateApiClientOptions) {
  const client = createClient<paths>({
    baseUrl: apiOrigin,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });

  const middleware: Middleware = {
    onRequest({ request }) {
      const headers = new Headers(request.headers);
      headers.set('X-Request-Id', newRequestId());
      const token = getAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      // login, refresh and logout need the httpOnly refresh cookie.
      return new Request(request, {
        headers,
        ...(isAuthRoute(request) && { credentials: 'include' }),
      });
    },
    async onResponse({ response }) {
      if (!response.ok) throw await parseErrorResponse(response);
      return undefined;
    },
    onError({ error }) {
      return networkError(error);
    },
  };
  client.use(middleware);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

let shared: ApiClient | undefined;

export function getApiClient(): ApiClient {
  shared ??= createApiClient({
    apiOrigin: getEnv().apiOrigin,
    getAccessToken: () => tokenStore.get(),
  });
  return shared;
}
