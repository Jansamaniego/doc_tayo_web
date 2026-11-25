import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';
import { useActiveTenantId } from '@/api/session/session-store.ts';

export type Branch = components['schemas']['BranchResponse'];
export type BranchChanges = components['schemas']['UpdateBranchDto'];
export type NewBranch = components['schemas']['CreateBranchDto'];
/** The list shows active branches unless told otherwise. */
export type BranchStatusFilter = 'inactive' | 'all';

export interface BranchFilters {
  page?: number | undefined;
  pageSize?: number | undefined;
  status?: BranchStatusFilter | undefined;
}

// Clinic data: every key starts with the clinic's id (AGENTS.md), so a clinic switch never shows the
// previous clinic's branches. A change invalidates the whole `branches` group.
export function useBranches(filters: BranchFilters) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'branches', 'list', filters],
    enabled: tenantId !== null,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0] === tenantId ? previous : undefined,
    queryFn: async () => {
      const query = {
        ...(filters.page !== undefined && { page: filters.page }),
        ...(filters.pageSize !== undefined && { pageSize: filters.pageSize }),
        ...(filters.status !== 'all' && { isActive: filters.status !== 'inactive' }),
      };
      const result = await getApiClient().GET('/api/v1/branches', { params: { query } });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data;
    },
  });
}

export function useBranch(branchId: string) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'branches', 'detail', branchId],
    enabled: tenantId !== null,
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/branches/{branchId}', {
        params: { path: { branchId } },
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  });
}

function useRefreshBranchesAfterChange() {
  const queryClient = useQueryClient();
  const tenantId = useActiveTenantId();
  return { onSettled: () => queryClient.invalidateQueries({ queryKey: [tenantId, 'branches'] }) };
}

export function useCreateBranch() {
  const refresh = useRefreshBranchesAfterChange();
  return useMutation({
    mutationFn: async (newBranch: NewBranch) => {
      const result = await getApiClient().POST('/api/v1/branches', { body: newBranch });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    ...refresh,
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  const tenantId = useActiveTenantId();
  const refresh = useRefreshBranchesAfterChange();
  return useMutation({
    mutationFn: async ({ branchId, changes }: { branchId: string; changes: BranchChanges }) => {
      const result = await getApiClient().PATCH('/api/v1/branches/{branchId}', {
        params: { path: { branchId } },
        body: changes,
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    // The page shows the answer at once; the reload that follows only confirms it.
    onSuccess: (branch, { branchId }) => {
      queryClient.setQueryData([tenantId, 'branches', 'detail', branchId], branch);
    },
    ...refresh,
  });
}
