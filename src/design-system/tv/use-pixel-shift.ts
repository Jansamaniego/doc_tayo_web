import { useEffect, useState } from 'react';

/**
 * Moves a small region (the clock) a few pixels every few minutes, so a screen that shows the same
 * picture all day does not burn it in. Returns the current offset.
 */
export function usePixelShift({
  intervalMs,
  maxPx,
  random = Math.random,
}: {
  intervalMs: number;
  maxPx: number;
  random?: () => number;
}): { x: number; y: number } {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const pick = (): number => Math.round((random() * 2 - 1) * maxPx);
    const timer = window.setInterval(() => {
      setOffset({ x: pick(), y: pick() });
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs, maxPx, random]);
  return offset;
}
