import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';
import { useActiveTenantId } from '@/api/session/session-store.ts';

export type Member = components['schemas']['MemberResponse'];
/** The statuses the Staff list can filter by. `invited` exists in the contract but the API never creates it. */
export type MemberStatusFilter = 'active' | 'suspended' | 'removed';

export interface MemberFilters {
  page?: number | undefined;
  pageSize?: number | undefined;
  q?: string | undefined;
  status?: MemberStatusFilter | undefined;
}

// Clinic data: every key starts with the clinic's id (AGENTS.md), so a clinic switch never shows the
// previous clinic's people.
export function useMembers(filters: MemberFilters) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'members', 'list', filters],
    enabled: tenantId !== null,
    // Keep the old page on screen while the next one loads, but only within the same clinic.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0] === tenantId ? previous : undefined,
    queryFn: async () => {
      const query = {
        ...(filters.page !== undefined && { page: filters.page }),
        ...(filters.pageSize !== undefined && { pageSize: filters.pageSize }),
        ...(filters.q && { q: filters.q }),
        ...(filters.status && { status: filters.status }),
      };
      const result = await getApiClient().GET('/api/v1/members', { params: { query } });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data;
    },
  });
}

export function useMember(membershipId: string) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'members', 'detail', membershipId],
    enabled: tenantId !== null,
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/members/{membershipId}', {
        params: { path: { membershipId } },
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  });
}

/** What an edit may change: only the fields that changed are sent. `jobTitle: null` clears it. */
export interface MemberChanges {
  roleIds?: string[];
  jobTitle?: string | null;
}

/** After any change, the person, the list and (when the answer was no) what the person may give are read again. */
function useRefreshAfterChange() {
  const queryClient = useQueryClient();
  const tenantId = useActiveTenantId();
  return {
    onSettled: () => queryClient.invalidateQueries({ queryKey: [tenantId, 'members'] }),
    onError: () => queryClient.invalidateQueries({ queryKey: [tenantId, 'roles'] }),
  };
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  const tenantId = useActiveTenantId();
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: async ({
      membershipId,
      changes,
    }: {
      membershipId: string;
      changes: MemberChanges;
    }) => {
      const result = await getApiClient().PATCH('/api/v1/members/{membershipId}', {
        params: { path: { membershipId } },
        body: changes,
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    // The page shows the answer at once; the reload that follows only confirms it.
    onSuccess: (member, { membershipId }) => {
      queryClient.setQueryData([tenantId, 'members', 'detail', membershipId], member);
    },
    ...refresh,
  });
}

export type MemberStatusAction = 'suspend' | 'reactivate' | 'remove';

export function useSetMemberStatus() {
  const refresh = useRefreshAfterChange();
  return useMutation({
    mutationFn: async ({
      membershipId,
      action,
    }: {
      membershipId: string;
      action: MemberStatusAction;
    }) => {
      const client = getApiClient();
      const path = { params: { path: { membershipId } } };
      if (action === 'suspend') await client.POST('/api/v1/members/{membershipId}/suspend', path);
      else if (action === 'reactivate')
        await client.POST('/api/v1/members/{membershipId}/reactivate', path);
      else await client.POST('/api/v1/members/{membershipId}/remove', path);
    },
    ...refresh,
  });
}
