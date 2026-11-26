import { useQuery } from '@tanstack/react-query';

import { getApiClient } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';
import { useActiveTenantId } from '@/api/session/session-store.ts';

export type DirectoryEntry = components['schemas']['DirectoryEntryResponse'];

export interface DirectoryFilters {
  /** Only members with an active practitioner profile. */
  practitionersOnly?: boolean | undefined;
  /** Only active practitioners with hours at this branch. */
  branchId?: string | undefined;
}

/** The most the API gives in one page. */
const PAGE_SIZE = 100;

async function fetchWholeDirectory(filters: DirectoryFilters): Promise<DirectoryEntry[]> {
  const entries: DirectoryEntry[] = [];
  for (let page = 1; ; page += 1) {
    const result = await getApiClient().GET('/api/v1/directory', {
      params: {
        query: {
          page,
          pageSize: PAGE_SIZE,
          ...(filters.practitionersOnly && { practitionersOnly: true }),
          ...(filters.branchId && { branchId: filters.branchId }),
        },
      },
    });
    if (!result.data) throw networkError(new Error('Empty answer.'));
    entries.push(...result.data.data);
    if (page >= result.data.meta.totalPages) return entries;
  }
}

/**
 * The active staff of the clinic, by name, read whole: the API has no search, and a picker must find
 * anyone (plans/07-appointments-and-scheduling.md, P7-3). It carries no e-mail addresses.
 */
export function useDirectory(filters: DirectoryFilters = {}) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'directory', filters],
    enabled: tenantId !== null,
    // The API marks the directory as never cached: names are not kept once no screen shows them.
    gcTime: 0,
    queryFn: () => fetchWholeDirectory(filters),
  });
}
