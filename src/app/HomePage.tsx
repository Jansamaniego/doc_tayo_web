import { Trans, useLingui } from '@lingui/react/macro';
import { CheckCircle2, TriangleAlert } from 'lucide-react';

import { isApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useApiHealth } from './useApiHealth.ts';

// A brand name is not translated.
const PRODUCT_NAME = 'DocTayo';

/** Placeholder home: proves the app can reach the API. Real screens start in Phase 3. */
export function HomePage() {
  const { t } = useLingui();
  usePageTitle(t`DocTayo`);
  const health = useApiHealth();
  const requestId = isApiError(health.error) ? health.error.requestId : undefined;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold">{PRODUCT_NAME}</h1>

      {health.isPending && (
        <p role="status" className="text-text-muted">
          <Trans>Checking the connection…</Trans>
        </p>
      )}

      {health.isSuccess && (
        <p role="status" className="flex items-center gap-2 font-semibold text-success">
          <CheckCircle2 aria-hidden="true" />
          <Trans>API reachable</Trans>
        </p>
      )}

      {health.isError && (
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-lg border-2 border-danger bg-danger-bg p-4"
        >
          <p className="flex items-center gap-2 font-semibold text-danger">
            <TriangleAlert aria-hidden="true" />
            <Trans>API not reachable</Trans>
          </p>
          <p>
            <Trans>We could not reach the DocTayo service. Please try again.</Trans>
          </p>
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
            <Button
              onClick={() => {
                void health.refetch();
              }}
            >
              <Trans>Try again</Trans>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
