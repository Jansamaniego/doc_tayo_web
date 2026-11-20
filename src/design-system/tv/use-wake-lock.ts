import { useEffect } from 'react';

/** Keeps the screen from sleeping (where the browser supports it), and asks again when the page is shown again. */
export function useWakeLock(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | undefined;
    let stopped = false;

    async function acquire(): Promise<void> {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (stopped) await lock.release();
        else sentinel = lock;
      } catch {
        // Not allowed right now (low battery, hidden page): the next visibility change tries again.
      }
    }

    void acquire();
    const onVisible = (): void => {
      void acquire(); // the browser drops the lock whenever the page is hidden
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, []);
}
