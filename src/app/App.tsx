import { I18nProvider } from '@lingui/react';
import { useLingui } from '@lingui/react/macro';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { getSession } from '@/api/session/index.ts';
import { useSession } from '@/api/session/session-store.ts';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { ToastRegion } from '@/design-system/components/toast.tsx';
import { i18n } from '@/i18n/index.ts';

import { router } from './router.ts';

const queryClient = new QueryClient();

/** The first refresh, once per page load (React runs effects twice in development). */
let booting: Promise<void> | undefined;
function boot(): void {
  booting ??= getSession().boot();
  void booting;
}

function Boot({ children }: { children: React.ReactNode }) {
  const { t } = useLingui();
  const session = useSession();
  useEffect(boot, []);

  if (session.status === 'booting') {
    return (
      <main id="main" className="mx-auto max-w-reading px-4 py-10">
        <LoadingState label={t`Loading…`} />
      </main>
    );
  }
  if (session.status === 'boot-failed') {
    return (
      <main id="main" className="mx-auto max-w-reading px-4 py-10">
        <ErrorState
          message={messageForError(session.error)}
          requestId={session.error.requestId}
          onRetry={() => {
            booting = undefined;
            boot();
          }}
        />
      </main>
    );
  }
  return children;
}

/** Keeps the page in step with the session: guards run again, and nothing cached for a clinic outlives it. */
function SessionSync() {
  const session = useSession();
  const key =
    session.status === 'signed-in' ? `in:${session.activeTenantId ?? ''}` : session.status;
  useEffect(() => {
    void router.invalidate();
  }, [key]);
  useEffect(
    () =>
      getSession().subscribe(() => {
        queryClient.clear();
      }),
    [],
  );
  return null;
}

export function App() {
  return (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <Boot>
          <RouterProvider router={router} />
          <SessionSync />
        </Boot>
        <ToastRegion />
      </QueryClientProvider>
    </I18nProvider>
  );
}
