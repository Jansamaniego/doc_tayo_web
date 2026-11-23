import { plural } from '@lingui/core/macro';
import { useEffect, useState } from 'react';

/** "45 seconds", "2 minutes": plain words for how long to wait. Minutes round up. */
export function formatWait(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return plural(minutes, { one: '# minute', other: '# minutes' });
  }
  return plural(seconds, { one: '# second', other: '# seconds' });
}

/** Seconds left of a wait (for example the API's `Retry-After`), ticking once a second down to 0. */
export function useCountdown(seconds: number | undefined): number {
  const [source, setSource] = useState(seconds);
  const [remaining, setRemaining] = useState(seconds ?? 0);
  if (seconds !== source) {
    setSource(seconds);
    setRemaining(seconds ?? 0);
  }
  const running = remaining > 0;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [running]);
  return remaining;
}
