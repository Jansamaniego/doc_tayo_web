import { describe, expect, it } from 'vitest';

import { buildCsp } from './csp.ts';

describe('buildCsp (production policy)', () => {
  const csp = buildCsp({ apiOrigin: 'https://api.example.com' });

  it('never allows inline or eval code', () => {
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('limits connections to this site and the API origin', () => {
    expect(csp).toContain("connect-src 'self' https://api.example.com");
  });

  it('forbids framing, base-uri changes and foreign forms', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it('only loads scripts, styles and fonts from this site', () => {
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("font-src 'self'");
  });
});

describe('buildCsp (dev policy)', () => {
  const csp = buildCsp({ apiOrigin: 'http://localhost:3000', dev: { styleNonce: 'abc123' } });

  it('allows the dev server socket and the dev style nonce, but only in dev', () => {
    expect(csp).toContain('ws://localhost:5173');
    expect(csp).toContain("'nonce-abc123'");
    expect(buildCsp({ apiOrigin: 'http://localhost:3000' })).not.toContain('nonce-');
  });
});
