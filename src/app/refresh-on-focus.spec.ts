import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startRefreshOnFocus } from './refresh-on-focus.ts';

const MINUTE_IN_MILLISECONDS = 60_000;

describe('startRefreshOnFocus (a change made by an admin shows up without a reload)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T08:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const start = (isSignedIn = true) => {
    const refreshSession = vi.fn(() => Promise.resolve());
    const stop = startRefreshOnFocus({ refreshSession, isSignedIn: () => isSignedIn });
    return { refreshSession, stop };
  };

  it('asks again who the person is when the window regains focus', () => {
    const { refreshSession, stop } = start();
    window.dispatchEvent(new Event('focus'));
    expect(refreshSession).toHaveBeenCalledTimes(1);
    stop();
  });

  it('also does so when the tab becomes visible again', () => {
    const { refreshSession, stop } = start();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refreshSession).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does so at most once a minute', () => {
    const { refreshSession, stop } = start();
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(MINUTE_IN_MILLISECONDS - 1);
    window.dispatchEvent(new Event('focus'));
    expect(refreshSession).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    window.dispatchEvent(new Event('focus'));
    expect(refreshSession).toHaveBeenCalledTimes(2);
    stop();
  });

  it('does nothing for a person who is not signed in', () => {
    const { refreshSession, stop } = start(false);
    window.dispatchEvent(new Event('focus'));
    expect(refreshSession).not.toHaveBeenCalled();
    stop();
  });

  it('stops listening when told to', () => {
    const { refreshSession, stop } = start();
    stop();
    window.dispatchEvent(new Event('focus'));
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
