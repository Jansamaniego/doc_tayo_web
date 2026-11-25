import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';
import { useActiveTenantId } from '@/api/session/session-store.ts';

export type Invitation = components['schemas']['InvitationListItemResponse'];
export type InvitationStatus = Invitation['status'];

export interface InvitationFilters {
  status: InvitationStatus;
  page?: number | undefined;
  pageSize?: number | undefined;
}

// Clinic data: every key starts with the clinic's id (AGENTS.md).
export function useInvitations(filters: InvitationFilters) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'invitations', 'list', filters],
    enabled: tenantId !== null,
    // Keep the old page on screen while the next one loads, but only within the same clinic.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0] === tenantId ? previous : undefined,
    queryFn: async () => {
      const query = {
        status: filters.status,
        ...(filters.page !== undefined && { page: filters.page }),
        ...(filters.pageSize !== undefined && { pageSize: filters.pageSize }),
      };
      const result = await getApiClient().GET('/api/v1/invitations', { params: { query } });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data;
    },
  });
}

/** Whatever the answer, the invitation lists are read again (an invitation may have changed meanwhile). */
function useRefreshInvitations() {
  const queryClient = useQueryClient();
  const tenantId = useActiveTenantId();
  return {
    onSettled: () => queryClient.invalidateQueries({ queryKey: [tenantId, 'invitations'] }),
  };
}

export function useCreateInvitation() {
  const refresh = useRefreshInvitations();
  return useMutation({
    mutationFn: async (body: { email: string; roleId: string }) => {
      const result = await getApiClient().POST('/api/v1/invitations', { body });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    ...refresh,
  });
}

export function useResendInvitation() {
  const refresh = useRefreshInvitations();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      await getApiClient().POST('/api/v1/invitations/{invitationId}/resend', {
        params: { path: { invitationId } },
      });
    },
    ...refresh,
  });
}

export function useRevokeInvitation() {
  const refresh = useRefreshInvitations();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      await getApiClient().POST('/api/v1/invitations/{invitationId}/revoke', {
        params: { path: { invitationId } },
      });
    },
    ...refresh,
  });
}
