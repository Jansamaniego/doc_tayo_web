import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/errors.ts';

import { createQueryClient } from './query-client.ts';

const apiError = (code: ConstructorParameters<typeof ApiError>[0]['code']) =>
  new ApiError({ status: 403, code, message: 'x', requestId: 'r', details: [] });

describe('createQueryClient', () => {
  it('tells the app when a request is refused with FORBIDDEN (the permissions or platform role may have changed)', async () => {
    const onForbidden = vi.fn();
    const client = createQueryClient({
      onForbidden,
      onClinicLost: vi.fn(),
      onTenantMismatch: vi.fn(),
    });
    await client
      .query({
        queryKey: ['x'],
        queryFn: () => Promise.reject(apiError('FORBIDDEN')),
        retry: false,
      })
      .catch(() => undefined);
    expect(onForbidden).toHaveBeenCalledTimes(1);
  });

  it('also does so for a failed change (mutation)', async () => {
    const onForbidden = vi.fn();
    const client = createQueryClient({
      onForbidden,
      onClinicLost: vi.fn(),
      onTenantMismatch: vi.fn(),
    });
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(apiError('FORBIDDEN')) })
      .execute(undefined)
      .catch(() => undefined);
    expect(onForbidden).toHaveBeenCalledTimes(1);
  });

  it('ignores every other error', async () => {
    const onForbidden = vi.fn();
    const client = createQueryClient({
      onForbidden,
      onClinicLost: vi.fn(),
      onTenantMismatch: vi.fn(),
    });
    await client
      .query({
        queryKey: ['y'],
        queryFn: () => Promise.reject(apiError('NOT_FOUND')),
        retry: false,
      })
      .catch(() => undefined);
    await client
      .query({
        queryKey: ['z'],
        queryFn: () => Promise.reject(new Error('boom')),
        retry: false,
      })
      .catch(() => undefined);
    expect(onForbidden).not.toHaveBeenCalled();
  });

  describe('losing access to the active clinic (plan 05 §5.5)', () => {
    it.each(['TENANT_NOT_SELECTED', 'TENANT_ACCESS_DENIED'] as const)(
      'tells the app once when a read is refused with %s, and does not treat it as FORBIDDEN',
      async (code) => {
        const onForbidden = vi.fn();
        const onClinicLost = vi.fn();
        const client = createQueryClient({ onForbidden, onClinicLost, onTenantMismatch: vi.fn() });
        await client
          .query({ queryKey: ['x'], queryFn: () => Promise.reject(apiError(code)), retry: false })
          .catch(() => undefined);
        expect(onClinicLost).toHaveBeenCalledTimes(1);
        expect(onForbidden).not.toHaveBeenCalled();
      },
    );

    it.each(['TENANT_NOT_SELECTED', 'TENANT_ACCESS_DENIED'] as const)(
      'also does so for a failed change (mutation) with %s',
      async (code) => {
        const onClinicLost = vi.fn();
        const client = createQueryClient({
          onForbidden: vi.fn(),
          onClinicLost,
          onTenantMismatch: vi.fn(),
        });
        await client
          .getMutationCache()
          .build(client, { mutationFn: () => Promise.reject(apiError(code)) })
          .execute(undefined)
          .catch(() => undefined);
        expect(onClinicLost).toHaveBeenCalledTimes(1);
      },
    );

    it.each(['FORBIDDEN', 'NOT_FOUND', 'TENANT_SUSPENDED', 'UNAUTHENTICATED'] as const)(
      'does not do so for %s',
      async (code) => {
        const onClinicLost = vi.fn();
        const client = createQueryClient({
          onForbidden: vi.fn(),
          onClinicLost,
          onTenantMismatch: vi.fn(),
        });
        await client
          .query({ queryKey: ['y'], queryFn: () => Promise.reject(apiError(code)), retry: false })
          .catch(() => undefined);
        expect(onClinicLost).not.toHaveBeenCalled();
      },
    );
  });

  describe('retrying a read', () => {
    const retry = (): ((count: number, error: unknown) => boolean) => {
      const option = createQueryClient({
        onTenantMismatch: vi.fn(),
        onForbidden: vi.fn(),
        onClinicLost: vi.fn(),
      }).getDefaultOptions().queries?.retry;
      if (typeof option !== 'function') throw new Error('retry must be a function');
      return option as (count: number, error: unknown) => boolean;
    };
    const failure = (status: number) =>
      new ApiError({ status, code: 'NOT_FOUND', message: 'x', requestId: 'r', details: [] });

    it.each([400, 403, 404, 409, 429])(
      'does not retry an answer the server gave on purpose (%s): it would not change',
      (status) => {
        expect(retry()(0, failure(status))).toBe(false);
      },
    );

    it('retries a server error and a lost connection, up to twice', () => {
      expect(retry()(0, failure(503))).toBe(true);
      expect(retry()(1, failure(500))).toBe(true);
      expect(retry()(2, failure(500))).toBe(false);
      expect(retry()(0, failure(0))).toBe(true);
    });
  });
});

describe('createQueryClient: a request made for another clinic', () => {
  const mismatch = (code: ApiError['code'] = 'TENANT_MISMATCH') =>
    new ApiError({ status: 409, code, message: 'x', requestId: 'r', details: [] });
  const handlers = () => ({
    onForbidden: vi.fn(),
    onClinicLost: vi.fn(),
    onTenantMismatch: vi.fn(),
  });

  it('asks again who the person is after TENANT_MISMATCH from a read', async () => {
    const given = handlers();
    const client = createQueryClient(given);
    await client
      .query({ queryKey: ['m'], queryFn: () => Promise.reject(mismatch()) })
      .catch(() => undefined);
    expect(given.onTenantMismatch).toHaveBeenCalledTimes(1);
    expect(given.onForbidden).not.toHaveBeenCalled();
    expect(given.onClinicLost).not.toHaveBeenCalled();
  });

  it('does the same after a failed change', async () => {
    const given = handlers();
    const client = createQueryClient(given);
    await client
      .getMutationCache()
      .build(client, { mutationFn: () => Promise.reject(mismatch()) })
      .execute(undefined)
      .catch(() => undefined);
    expect(given.onTenantMismatch).toHaveBeenCalledTimes(1);
  });

  it.each(['VERSION_CONFLICT', 'CONFLICT', 'FORBIDDEN'] as const)(
    'does not do it for %s',
    async (code) => {
      const given = handlers();
      const client = createQueryClient(given);
      await client
        .query({ queryKey: [code], queryFn: () => Promise.reject(mismatch(code)), retry: false })
        .catch(() => undefined);
      expect(given.onTenantMismatch).not.toHaveBeenCalled();
    },
  );
});
