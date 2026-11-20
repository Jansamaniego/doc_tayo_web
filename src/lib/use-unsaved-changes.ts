import { useEffect } from 'react';

/**
 * While a form has unsaved changes, the browser asks before the tab is closed or reloaded.
 * (Leaving to another page inside the app is guarded by the router in Phase 3, with the
 * "Leave without saving?" dialog.)
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
