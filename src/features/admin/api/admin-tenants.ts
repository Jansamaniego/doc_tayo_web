import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';

export type TenantStatus = components['schemas']['AdminTenantListItem']['status'];
export type AdminTenantListItem = components['schemas']['AdminTenantListItem'];
export type AdminTenantDetail = components['schemas']['AdminTenantDetail'];
export type CreateTenantBody = components['schemas']['CreateTenantDto'];

export interface TenantFilters {
  page?: number | undefined;
  pageSize?: number | undefined;
  q?: string | undefined;
  status?: TenantStatus | undefined;
}

// Platform data belongs to no clinic, so its keys start with 'admin', not with a clinic id.
const KEY = ['admin', 'tenants'] as const;

export function useAdminTenants(filters: TenantFilters) {
  return useQuery({
    queryKey: [...KEY, 'list', filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const query = {
        ...(filters.page !== undefined && { page: filters.page }),
        ...(filters.pageSize !== undefined && { pageSize: filters.pageSize }),
        ...(filters.q && { q: filters.q }),
        ...(filters.status && { status: filters.status }),
      };
      const result = await getApiClient().GET('/api/v1/admin/tenants', { params: { query } });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data;
    },
  });
}

export function useAdminTenant(tenantId: string) {
  return useQuery({
    queryKey: [...KEY, 'detail', tenantId],
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/admin/tenants/{tenantId}', {
        params: { path: { tenantId } },
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  });
}

/** Suspend, reactivate or deactivate. Whatever the answer, the clinic and the lists are read again. */
export function useSetTenantStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, status }: { tenantId: string; status: TenantStatus }) => {
      await getApiClient().PATCH('/api/v1/admin/tenants/{tenantId}/status', {
        params: { path: { tenantId } },
        body: { status },
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTenantBody) => {
      const result = await getApiClient().POST('/api/v1/admin/tenants', { body });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
