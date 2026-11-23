import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatWait, useCountdown } from './countdown.ts';

describe('formatWait (plain words for "please wait")', () => {
  it.each([
    [1, '1 second'],
    [45, '45 seconds'],
    [59, '59 seconds'],
    [60, '1 minute'],
    [61, '2 minutes'],
    [120, '2 minutes'],
    [900, '15 minutes'],
    [0, '0 seconds'],
  ])('%i seconds is "%s"', (seconds, expected) => {
    expect(formatWait(seconds)).toBe(expected);
  });
});

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down once a second to zero and stops', () => {
    const { result } = renderHook(() => useCountdown(3));
    expect(result.current).toBe(3);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(2);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is 0 when there is nothing to wait for', () => {
    expect(renderHook(() => useCountdown(undefined)).result.current).toBe(0);
  });

  it('starts again when given a new wait', () => {
    const { result, rerender } = renderHook(({ seconds }) => useCountdown(seconds), {
      initialProps: { seconds: 2 },
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(0);
    rerender({ seconds: 10 });
    expect(result.current).toBe(10);
  });
});
