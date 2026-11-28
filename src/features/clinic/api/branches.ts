import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';
import { useActiveTenantId } from '@/api/session/session-store.ts';

import { useClinicProfile } from './tenant.ts';

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

/** `branchId` may be '' while none is chosen (nothing is asked). */
export function useBranch(branchId: string) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'branches', 'detail', branchId],
    enabled: tenantId !== null && branchId !== '',
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/branches/{branchId}', {
        params: { path: { branchId } },
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  });
}

/**
 * The zone a branch's days and times are in: its own, or the clinic's when it has none. Undefined
 * while the branch or the clinic is not known, so a time is never shown in a guessed zone.
 */
export function branchTimeZone(known: {
  branch: Pick<Branch, 'timezone'>;
  clinicZone: string;
}): string;
export function branchTimeZone(maybe: {
  branch: Pick<Branch, 'timezone'> | undefined;
  clinicZone: string | undefined;
}): string | undefined;
export function branchTimeZone({
  branch,
  clinicZone,
}: {
  branch: Pick<Branch, 'timezone'> | undefined;
  clinicZone: string | undefined;
}): string | undefined {
  if (!branch) return undefined;
  return branch.timezone ?? clinicZone;
}

/** The time zone of one branch (`''` while none is chosen). */
export function useBranchTimeZone(branchId: string): string | undefined {
  const branch = useBranch(branchId).data;
  const clinicZone = useClinicProfile().data?.timezone;
  return branchTimeZone({ branch, clinicZone });
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
