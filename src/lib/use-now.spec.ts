import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNow } from './use-now.ts';

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-12-06T15:59:40.000Z') });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useNow', () => {
  it('gives the time it is', () => {
    const { result } = renderHook(() => useNow());
    expect(result.current.toISOString()).toBe('2026-12-06T15:59:40.000Z');
  });

  it('moves on at each new minute, not a minute after the screen opened', () => {
    const { result } = renderHook(() => useNow());
    act(() => {
      vi.advanceTimersByTime(19_000);
    });
    expect(result.current.toISOString()).toBe('2026-12-06T15:59:40.000Z');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.toISOString()).toBe('2026-12-06T16:00:00.000Z');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.toISOString()).toBe('2026-12-06T16:01:00.000Z');
  });

  it('catches up when the window is shown again (a sleeping computer runs no timers)', () => {
    const { result } = renderHook(() => useNow());
    vi.setSystemTime(new Date('2026-12-07T03:00:00.000Z'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.toISOString()).toBe('2026-12-07T03:00:00.000Z');
  });

  it('stops its timer when the screen goes', () => {
    const { unmount } = renderHook(() => useNow());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
