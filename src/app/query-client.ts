import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { isApiError } from '@/api/errors.ts';

/** An answer the server gave on purpose (not found, not allowed, too many) would not change on a retry. */
function retryRead(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

/**
 * One place for what every failed request has in common. A `FORBIDDEN` means the person's permissions
 * or platform role may have changed since they signed in, so the app asks who they are again
 * (docs/frontend-integration.md §5); what the screen then shows follows from the new answer.
 * `TENANT_NOT_SELECTED` and `TENANT_ACCESS_DENIED` mean an admin suspended or removed the person
 * from the clinic they had open: the same "ask again" applies, and the clinic guard then sends
 * them to the picker (docs/staff-management-integration.md 4.5).
 * `TENANT_MISMATCH` means the request named a clinic that is no longer the active one (switched in
 * another tab): the session is read again so this tab shows the clinic it is really in. What the
 * person typed stays on the page (docs/clinical-integration.md).
 */
export function createQueryClient({
  onForbidden,
  onClinicLost,
  onTenantMismatch,
}: {
  onForbidden: () => void;
  onClinicLost: () => void;
  onTenantMismatch: () => void;
}): QueryClient {
  const onError = (error: unknown): void => {
    if (!isApiError(error)) return;
    if (error.code === 'FORBIDDEN') onForbidden();
    else if (error.code === 'TENANT_MISMATCH') onTenantMismatch();
    else if (error.code === 'TENANT_NOT_SELECTED' || error.code === 'TENANT_ACCESS_DENIED') {
      onClinicLost();
    }
  };
  return new QueryClient({
    defaultOptions: { queries: { retry: retryRead } },
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
  });
}
