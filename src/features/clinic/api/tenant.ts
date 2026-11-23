import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';
import { useActiveTenantId } from '@/api/session/session-store.ts';

export type ClinicProfile = components['schemas']['TenantResponse'];
/** What an edit may change: only the fields that changed are sent. `null` clears an email or phone. */
export type ClinicProfileChanges = components['schemas']['UpdateTenantDto'];

/** The clinic's own details (`GET /tenant`). Also gives the Staff screens the zone their dates are shown in. */
export function useClinicProfile() {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'tenant'],
    enabled: tenantId !== null,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/tenant');
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  });
}

export function useUpdateClinicProfile() {
  const queryClient = useQueryClient();
  const tenantId = useActiveTenantId();
  return useMutation({
    mutationFn: async (changes: ClinicProfileChanges) => {
      const result = await getApiClient().PATCH('/api/v1/tenant', { body: changes });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    // The page shows the answer at once. Everything else for this clinic is read again: dates follow
    // the clinic's time zone, so a changed zone changes what many screens show.
    onSuccess: (clinic) => {
      queryClient.setQueryData([tenantId, 'tenant'], clinic);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [tenantId] }),
  });
}
