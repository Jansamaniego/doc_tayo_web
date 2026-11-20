import { useEffect } from 'react';

/** Sets the browser tab title; the route announcer reads it to screen readers after navigation. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
