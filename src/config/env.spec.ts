import { describe, expect, it } from 'vitest';

import { parseEnv } from './env.ts';

const valid = { VITE_API_ORIGIN: 'http://localhost:3000', VITE_APP_ENV: 'development' };

describe('parseEnv', () => {
  it('accepts a valid configuration', () => {
    const result = parseEnv(valid);
    expect(result).toEqual({
      ok: true,
      env: {
        apiOrigin: 'http://localhost:3000',
        appEnv: 'development',
        errorReportingDsn: undefined,
      },
    });
  });

  it('accepts an https origin with a port and the optional DSN', () => {
    const result = parseEnv({
      VITE_API_ORIGIN: 'https://api.example.com:8443',
      VITE_APP_ENV: 'production',
      VITE_ERROR_REPORTING_DSN: 'https://key@example.com/1',
    });
    expect(result).toMatchObject({ ok: true, env: { apiOrigin: 'https://api.example.com:8443' } });
  });

  it('treats an empty DSN as not set', () => {
    const result = parseEnv({ ...valid, VITE_ERROR_REPORTING_DSN: '' });
    expect(result).toMatchObject({ ok: true, env: { errorReportingDsn: undefined } });
  });

  it('rejects a missing API origin and names the key', () => {
    expect(parseEnv({ VITE_APP_ENV: 'development' })).toEqual({
      ok: false,
      invalidKeys: ['VITE_API_ORIGIN'],
    });
  });

  it.each([
    ['a relative URL', '/api/v1'],
    ['a trailing slash', 'http://localhost:3000/'],
    ['a path (the generated schema already has /api/v1)', 'http://localhost:3000/api/v1'],
    ['a query string', 'http://localhost:3000?x=1'],
    ['a non-http scheme', 'ftp://localhost:3000'],
    ['plain text', 'not a url'],
  ])('rejects %s', (_label, value) => {
    expect(parseEnv({ ...valid, VITE_API_ORIGIN: value })).toEqual({
      ok: false,
      invalidKeys: ['VITE_API_ORIGIN'],
    });
  });

  it('rejects an unknown environment name', () => {
    expect(parseEnv({ ...valid, VITE_APP_ENV: 'qa' })).toEqual({
      ok: false,
      invalidKeys: ['VITE_APP_ENV'],
    });
  });

  it('lists key names only, never the invalid values', () => {
    const result = parseEnv({ VITE_API_ORIGIN: 'secret-looking-value', VITE_APP_ENV: 'qa' });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret-looking-value');
    expect(JSON.stringify(result)).not.toContain('"qa"');
  });
});
