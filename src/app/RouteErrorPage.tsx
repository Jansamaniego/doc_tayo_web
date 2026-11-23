import { Trans, useLingui } from '@lingui/react/macro';

import { messageForError } from '@/api/error-messages.ts';
import { isApiError } from '@/api/errors.ts';
import { getEnv } from '@/config/env.ts';
import { ErrorState } from '@/design-system/components/state-views.tsx';

// Seam for Phase 13 (error monitoring, plan.md Q14): the one place that reports an unexpected error.
// Never send bodies, form values, names or emails; only the user id and the API's requestId.
function reportError({
  error,
  requestId,
}: {
  error: unknown;
  requestId: string | undefined;
}): void {
  if (getEnv().appEnv === 'development') console.error('Unexpected error', { error, requestId });
}

/** Shown when a page fails unexpectedly; the app shell around it stays usable. */
export function RouteErrorPage({ error, reset }: { error: unknown; reset: () => void }) {
  const { t } = useLingui();
  const requestId = isApiError(error) ? error.requestId : undefined;
  reportError({ error, requestId });
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex max-w-reading flex-col gap-4 px-4 py-10 outline-none"
    >
      <h1>
        <Trans>Something went wrong</Trans>
      </h1>
      <ErrorState
        message={isApiError(error) ? messageForError(error) : t`Please try again.`}
        requestId={requestId}
        onRetry={reset}
      />
    </main>
  );
}
