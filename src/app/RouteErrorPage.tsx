import { Trans } from '@lingui/react/macro';
import { TriangleAlert } from 'lucide-react';

import { messageForError } from '@/api/error-messages.ts';
import { isApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { getEnv } from '@/config/env.ts';

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
  const requestId = isApiError(error) ? error.requestId : undefined;
  reportError({ error, requestId });
  return (
    <div role="alert" className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="flex items-center gap-2 text-3xl font-bold text-danger">
        <TriangleAlert aria-hidden="true" />
        <Trans>Something went wrong</Trans>
      </h1>
      <p>{isApiError(error) ? messageForError(error) : <Trans>Please try again.</Trans>}</p>
      {requestId && (
        <details>
          <summary className="min-h-11 cursor-pointer py-2">
            <Trans>Details for support</Trans>
          </summary>
          <p>
            <Trans>Reference: {requestId}</Trans>
          </p>
        </details>
      )}
      <div>
        <Button onClick={reset}>
          <Trans>Try again</Trans>
        </Button>
      </div>
    </div>
  );
}
