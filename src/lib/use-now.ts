import { useEffect, useState } from 'react';

const MINUTE = 60_000;

/**
 * The time, renewed at the start of every minute and when the window is shown again, so that "today"
 * and "has this started?" stay true on a screen that is left open.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number;
    const tick = (): void => {
      setNow(new Date());
      schedule();
    };
    const schedule = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, MINUTE - (Date.now() % MINUTE));
    };
    schedule();
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return now;
}
