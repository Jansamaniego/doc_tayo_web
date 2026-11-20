import { afterEach, describe, expect, it, vi } from 'vitest';

import { tokenStore } from './token-store.ts';

afterEach(() => {
  tokenStore.clear();
});

describe('tokenStore', () => {
  it('starts empty', () => {
    expect(tokenStore.get()).toBeNull();
  });

  it('keeps the access token in memory and clears it', () => {
    tokenStore.set('abc');
    expect(tokenStore.get()).toBe('abc');
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });

  it('notifies subscribers on set and clear, and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = tokenStore.subscribe(listener);
    tokenStore.set('abc');
    tokenStore.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    tokenStore.set('def');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('never writes the token to browser storage (privacy / token rule)', () => {
    tokenStore.set('super-secret-token');
    const everything = (storage: Storage): string =>
      Object.keys(storage)
        .map((key) => `${key}=${storage.getItem(key) ?? ''}`)
        .join('&');
    expect(everything(window.localStorage)).not.toContain('super-secret-token');
    expect(everything(window.sessionStorage)).not.toContain('super-secret-token');
    expect(document.cookie).not.toContain('super-secret-token');
  });
});
