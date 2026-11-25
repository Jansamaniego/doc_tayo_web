import { useEffect } from 'react';

/**
 * While a form has unsaved changes, the browser asks before the tab is closed or reloaded.
 * (A form that must also ask before moving to another page inside the app uses `LeaveGuard`,
 * ./leave-guard.tsx, which covers both.)
 */
export function useUnsavedChanges(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [dirty]);
}
