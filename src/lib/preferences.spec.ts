import { afterEach, describe, expect, it, vi } from 'vitest';

import { readPreference, writePreference } from './preferences.ts';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('preferences', () => {
  it('returns the default when nothing is stored', () => {
    expect(readPreference('sharedComputer')).toBe(false);
    expect(readPreference('lastBranchId')).toBeNull();
  });

  it('round-trips a stored value', () => {
    writePreference('sharedComputer', true);
    expect(readPreference('sharedComputer')).toBe(true);
    writePreference('lastBranchId', '0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b');
    expect(readPreference('lastBranchId')).toBe('0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b');
  });

  it('falls back to the default for garbage or a wrong type', () => {
    window.localStorage.setItem('doctayo.pref.sharedComputer', 'not json');
    expect(readPreference('sharedComputer')).toBe(false);
    window.localStorage.setItem('doctayo.pref.sharedComputer', JSON.stringify('yes'));
    expect(readPreference('sharedComputer')).toBe(false);
  });

  it('survives storage that throws (private mode, blocked storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readPreference('sharedComputer')).toBe(false);
    expect(() => {
      writePreference('sharedComputer', true);
    }).not.toThrow();
  });
});
