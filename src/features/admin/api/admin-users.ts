import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';

export type AdminUser = components['schemas']['AdminUserResponse'];
export type UserStatus = AdminUser['status'];

export interface UserFilters {
  page?: number | undefined;
  pageSize?: number | undefined;
  q?: string | undefined;
  status?: UserStatus | undefined;
}

// Platform data belongs to no clinic, so its keys start with 'admin', not with a clinic id.
const KEY = ['admin', 'users'] as const;

export function useAdminUsers(filters: UserFilters) {
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
      const result = await getApiClient().GET('/api/v1/admin/users', { params: { query } });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data;
    },
  });
}

export function useAdminUser(userId: string) {
  return useQuery({
    queryKey: [...KEY, 'detail', userId],
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/admin/users/{userId}', {
        params: { path: { userId } },
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  });
}

/** Deactivate or reactivate. Whatever the answer, the account and the lists are read again. */
export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      status,
    }: {
      userId: string;
      status: 'active' | 'deactivated';
    }) => {
      await getApiClient().PATCH('/api/v1/admin/users/{userId}/status', {
        params: { path: { userId } },
        body: { status },
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
