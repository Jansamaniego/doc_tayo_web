import { useQuery } from '@tanstack/react-query';

import { getApiClient } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';
import { useActiveTenantId } from '@/api/session/session-store.ts';

export type Role = components['schemas']['RoleResponse'];

export function useRoles({ enabled = true }: { enabled?: boolean } = {}) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'roles'],
    enabled: enabled && tenantId !== null,
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/roles');
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  });
}

/** What each permission key means, in words. */
export function usePermissionDescriptions({ enabled = true }: { enabled?: boolean } = {}) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'permissions'],
    enabled: enabled && tenantId !== null,
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/permissions');
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  });
}
