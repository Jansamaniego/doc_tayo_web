import { Trans, useLingui } from '@lingui/react/macro';

import { isApiError } from '@/api/errors.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { PageHeader } from '@/design-system/patterns/page-header.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useApiHealth } from './useApiHealth.ts';

// A brand name is not translated.
const PRODUCT_NAME = 'DocTayo';

/** Placeholder home: proves the app can reach the API. Real screens start in Phase 3. */
export function HomePage() {
  const { t } = useLingui();
  usePageTitle(PRODUCT_NAME);
  const health = useApiHealth();
  const requestId = isApiError(health.error) ? health.error.requestId : undefined;

  return (
    <div className="mx-auto flex max-w-reading flex-col gap-6 px-4 py-10">
      <PageHeader title={PRODUCT_NAME} />
      {health.isPending && <LoadingState label={t`Checking the connection…`} />}
      {health.isSuccess && (
        <Alert variant="success">
          <Trans>API reachable</Trans>
        </Alert>
      )}
      {health.isError && (
        <ErrorState
          message={t`API not reachable`}
          requestId={requestId}
          onRetry={() => {
            void health.refetch();
          }}
        />
      )}
    </div>
  );
}
