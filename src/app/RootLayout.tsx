import { Trans } from '@lingui/react/macro';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

/**
 * The frame around every page: a skip link, the main landmark, and navigation feedback for
 * keyboard and screen-reader users (focus moves to the content, the new page title is announced).
 */
export function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const firstRender = useRef(true);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById('main')?.focus();
    // The page sets its title in an effect of its own; read it after that has run.
    const timer = window.setTimeout(() => {
      setAnnouncement(document.title);
    }, 100);
    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname]);

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
