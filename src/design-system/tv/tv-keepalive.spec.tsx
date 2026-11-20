import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePixelShift } from './use-pixel-shift.ts';
import { useWakeLock } from './use-wake-lock.ts';

describe('usePixelShift (reduces burn-in on long-running screens)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts centred and moves by a few pixels every interval, never beyond the limit', () => {
    const { result } = renderHook(() => usePixelShift({ intervalMs: 60_000, maxPx: 6 }));
    expect(result.current).toEqual({ x: 0, y: 0 });
    const seen = new Set<string>();
    for (let step = 0; step < 30; step += 1) {
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      const { x, y } = result.current;
      expect(Math.abs(x)).toBeLessThanOrEqual(6);
      expect(Math.abs(y)).toBeLessThanOrEqual(6);
      seen.add(`${x},${y}`);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('stops its timer when the screen is closed', () => {
    const { unmount } = renderHook(() => usePixelShift({ intervalMs: 1000, maxPx: 4 }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('useWakeLock (keeps the screen awake)', () => {
  function Probe() {
    useWakeLock();
    return null;
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('asks the browser to keep the screen on, and lets go on unmount', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release, addEventListener: () => undefined });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    const { unmount } = render(<Probe />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledWith('screen');
    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(release).toHaveBeenCalled();
  });

  it('asks again when the page becomes visible again (the browser drops the lock when hidden)', async () => {
    const request = vi.fn().mockResolvedValue({
      release: vi.fn().mockResolvedValue(undefined),
      addEventListener: () => undefined,
    });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    render(<Probe />);
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(request.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does nothing, and does not throw, where wake lock is not supported', () => {
    expect(() => render(<Probe />)).not.toThrow();
  });
});
