import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient, requestHeaders } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';
import { useActiveTenantId } from '@/api/session/session-store.ts';

export type Service = components['schemas']['ServiceResponse'];

export interface ServiceFilters {
  page?: number | undefined;
  pageSize?: number | undefined;
  /** Also the deactivated ones (only offered to people who manage services). */
  includeInactive?: boolean | undefined;
}

export function useServices(filters: ServiceFilters) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'services', 'list', filters],
    enabled: tenantId !== null,
    // Keep the old page on screen while the next one loads, but only within the same clinic.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0] === tenantId ? previous : undefined,
    queryFn: async () => {
      const query = {
        ...(filters.page !== undefined && { page: filters.page }),
        ...(filters.pageSize !== undefined && { pageSize: filters.pageSize }),
        ...(filters.includeInactive && { includeInactive: true }),
      };
      const result = await getApiClient().GET('/api/v1/services', { params: { query } });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data;
    },
  });
}

const detailKey = ({ tenantId, serviceId }: { tenantId: string | null; serviceId: string }) => [
  tenantId,
  'services',
  'detail',
  serviceId,
];

function useServiceQuery(serviceId: string) {
  const tenantId = useActiveTenantId();
  return {
    queryKey: detailKey({ tenantId, serviceId }),
    enabled: tenantId !== null,
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/services/{serviceId}', {
        params: { path: { serviceId } },
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  };
}

export function useService(serviceId: string) {
  return useQuery(useServiceQuery(serviceId));
}

/**
 * For the edit form, which has no `version` to protect what it changes: always asked again, so use the
 * data only once `isFetchedAfterMount`.
 */
export function useFreshService(serviceId: string) {
  return useQuery({ ...useServiceQuery(serviceId), refetchOnMount: 'always' });
}

export type NewService = components['schemas']['CreateServiceDto'];
export type ServiceChanges = components['schemas']['UpdateServiceDto'];

/**
 * After a save: the answer shows at once, and the clinic's services are read again whatever the answer
 * was (a refused name may mean an earlier try did save it).
 */
function useServiceCache() {
  const queryClient = useQueryClient();
  return {
    onSuccess: (service: Service, { tenantId }: { tenantId: string }) => {
      queryClient.setQueryData(detailKey({ tenantId, serviceId: service.id }), service);
    },
    onSettled: (_data: unknown, _error: unknown, { tenantId }: { tenantId: string }) =>
      queryClient.invalidateQueries({ queryKey: [tenantId, 'services'] }),
  };
}

/** Adds a service to the clinic the form was opened in. */
export function useCreateService() {
  return useMutation({
    mutationFn: async ({ body, tenantId }: { body: NewService; tenantId: string }) => {
      const result = await getApiClient().POST('/api/v1/services', {
        body,
        headers: requestHeaders({ tenantId }),
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    ...useServiceCache(),
  });
}

/** Edits, deactivates or reactivates a service. There is no version: the last save wins. */
export function useUpdateService() {
  return useMutation({
    mutationFn: async ({
      serviceId,
      tenantId,
      changes,
    }: {
      serviceId: string;
      tenantId: string;
      changes: ServiceChanges;
    }) => {
      const result = await getApiClient().PATCH('/api/v1/services/{serviceId}', {
        params: { path: { serviceId } },
        body: changes,
        headers: requestHeaders({ tenantId }),
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    ...useServiceCache(),
  });
}
