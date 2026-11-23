import { afterEach, describe, expect, it } from 'vitest';

import { readTokenFromFragment } from './fragment-token.ts';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

// The emailed token is in the URL fragment (#token=...), so it is never sent to a server or logged.
// Read it in the browser, then remove it from the address bar (docs/frontend-integration.md §7).
describe('readTokenFromFragment', () => {
  it('returns the token and removes it from the address bar, keeping the path and query', () => {
    window.history.replaceState(null, '', '/reset-password?lang=en#token=abc123');
    expect(readTokenFromFragment()).toBe('abc123');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname + window.location.search).toBe('/reset-password?lang=en');
  });

  it('decodes an encoded token', () => {
    window.history.replaceState(null, '', '/reset-password#token=a%2Bb%3Dc');
    expect(readTokenFromFragment()).toBe('a+b=c');
  });

  it('returns null, and touches nothing, when there is no token', () => {
    window.history.replaceState(null, '', '/reset-password#other=1');
    expect(readTokenFromFragment()).toBeNull();
    expect(window.location.hash).toBe('#other=1');
  });

  it('returns null for an empty token', () => {
    window.history.replaceState(null, '', '/reset-password#token=');
    expect(readTokenFromFragment()).toBeNull();
  });

  it('removes only the token when something else is in the fragment', () => {
    window.history.replaceState(null, '', '/x#token=abc&keep=1');
    expect(readTokenFromFragment()).toBe('abc');
    expect(window.location.hash).toBe('#keep=1');
  });

  it('can only be read once: after that the address bar no longer has it', () => {
    window.history.replaceState(null, '', '/x#token=abc');
    expect(readTokenFromFragment()).toBe('abc');
    expect(readTokenFromFragment()).toBeNull();
  });

  it('never puts the token in the history entry (replace, not push)', () => {
    const before = window.history.length;
    window.history.replaceState(null, '', '/x#token=abc');
    readTokenFromFragment();
    expect(window.history.length).toBe(before);
  });
});
