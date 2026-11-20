import { describe, expect, it } from 'vitest';

import { ApiError, isApiError, networkError, parseErrorResponse } from './errors.ts';

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('parseErrorResponse', () => {
  it('parses the documented validation error with details', async () => {
    const error = await parseErrorResponse(
      json(400, {
        error: {
          status: 400,
          code: 'VALIDATION_FAILED',
          message: 'Some fields need attention.',
          details: [{ field: 'newPassword', code: 'PASSWORD_TOO_COMMON', message: 'Too common.' }],
          requestId: '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
        },
      }),
    );
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Some fields need attention.',
      requestId: '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      details: [{ field: 'newPassword', code: 'PASSWORD_TOO_COMMON', message: 'Too common.' }],
    });
  });

  it('keeps ACCESS_TOKEN_EXPIRED as its own code (Phase 3 refreshes on it)', async () => {
    const error = await parseErrorResponse(
      json(401, {
        error: { status: 401, code: 'ACCESS_TOKEN_EXPIRED', message: 'x', requestId: 'r-1' },
      }),
    );
    expect(error.code).toBe('ACCESS_TOKEN_EXPIRED');
    expect(error.details).toEqual([]);
  });

  it('reads Retry-After on 429 as whole seconds', async () => {
    const error = await parseErrorResponse(
      json(
        429,
        { error: { status: 429, code: 'RATE_LIMITED', message: 'x', requestId: 'r-2' } },
        { 'retry-after': '120' },
      ),
    );
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.retryAfterSeconds).toBe(120);
  });

  it('ignores a Retry-After that is not a number of seconds', async () => {
    const error = await parseErrorResponse(
      json(
        429,
        { error: { status: 429, code: 'RATE_LIMITED', message: 'x', requestId: 'r-3' } },
        { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' },
      ),
    );
    expect(error.retryAfterSeconds).toBeUndefined();
  });

  it('turns a non-JSON 502 into INTERNAL_ERROR and keeps the X-Request-Id header', async () => {
    const error = await parseErrorResponse(
      new Response('<html>Bad gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html', 'x-request-id': 'header-request-id' },
      }),
    );
    expect(error).toMatchObject({
      status: 502,
      code: 'INTERNAL_ERROR',
      requestId: 'header-request-id',
    });
    expect(error.message).not.toContain('Bad gateway');
  });

  it('treats a JSON body without the error shape as INTERNAL_ERROR', async () => {
    const error = await parseErrorResponse(json(500, { oops: true }));
    expect(error.code).toBe('INTERNAL_ERROR');
  });

  it('maps a code this client does not know to UNKNOWN_ERROR but keeps the server message', async () => {
    const error = await parseErrorResponse(
      json(409, {
        error: { status: 409, code: 'BRAND_NEW_CODE', message: 'Server text', requestId: 'r-4' },
      }),
    );
    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.message).toBe('Server text');
  });

  it('maps an unknown field-level code to UNKNOWN_ERROR', async () => {
    const error = await parseErrorResponse(
      json(400, {
        error: {
          status: 400,
          code: 'VALIDATION_FAILED',
          message: 'x',
          details: [{ field: 'a.b', code: 'NEW_FIELD_CODE', message: 'm' }],
          requestId: 'r-5',
        },
      }),
    );
    expect(error.details).toEqual([{ field: 'a.b', code: 'UNKNOWN_ERROR', message: 'm' }]);
  });
});

describe('networkError', () => {
  it('is a client-only NETWORK_ERROR with status 0 and no request id', () => {
    const error = networkError(new TypeError('Failed to fetch'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(error.requestId).toBeUndefined();
  });
});

describe('isApiError', () => {
  it('is false for other errors and values', () => {
    expect(isApiError(new Error('x'))).toBe(false);
    expect(isApiError({ code: 'NOT_FOUND' })).toBe(false);
    expect(isApiError(undefined)).toBe(false);
  });
});
