import { Trans } from '@lingui/react/macro';
import { Outlet, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

/**
 * The frame around every page: a skip link, the main landmark, and navigation feedback for
 * keyboard and screen-reader users (focus moves to the content, the new page title is announced).
 */
export function RootLayout() {
  const router = useRouter();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    let timer: number | undefined;
    // Only a finished navigation FROM another page moves focus: never the first load, so the skip
    // link stays the first Tab stop.
    const unsubscribe = router.subscribe('onResolved', ({ fromLocation, pathChanged }) => {
      if (!fromLocation || !pathChanged) return;
      document.getElementById('main')?.focus();
      // The page sets its title in an effect of its own; read it after that has run.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setAnnouncement(document.title);
      }, 100);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [router]);

  return (
    <>
      <a
        href="#main"
        className="absolute left-2 top-2 z-50 -translate-y-20 rounded-lg bg-primary px-4 py-3 font-semibold text-on-primary focus:translate-y-0"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        <Trans>Skip to main content</Trans>
      </a>
      <main id="main" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
    </>
  );
}
