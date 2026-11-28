import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient, requestHeaders } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';
import { useActiveTenantId } from '@/api/session/session-store.ts';

export type Practitioner = components['schemas']['PractitionerProfileResponse'];
export type ScheduleBlock = Practitioner['schedule'][number];

const detailKey = ({ tenantId, profileId }: { tenantId: string | null; profileId: string }) => [
  tenantId,
  'practitioners',
  'detail',
  profileId,
];

function usePractitionerQuery(profileId: string) {
  const tenantId = useActiveTenantId();
  return {
    queryKey: detailKey({ tenantId, profileId }),
    // `''` while there is no profile to read.
    enabled: tenantId !== null && profileId !== '',
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/practitioners/{profileId}', {
        params: { path: { profileId } },
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  };
}

export function usePractitioner(profileId: string) {
  return useQuery(usePractitionerQuery(profileId));
}

/**
 * For a form that replaces what it shows, with no `version` to protect it: always asked again, so use
 * the data only once `isFetchedAfterMount`.
 */
export function useFreshPractitioner(profileId: string) {
  return useQuery({ ...usePractitionerQuery(profileId), refetchOnMount: 'always' });
}

/**
 * The working hours of one day at one branch (`date` is a calendar day in the branch's zone), minus
 * the practitioner's booked appointments at any branch (walk-ins are not taken out). Information
 * only: booking outside these hours is allowed.
 */
export function useAvailability({
  profileId,
  branchId,
  date,
}: {
  profileId: string;
  branchId: string;
  /** `YYYY-MM-DD`, or '' while none is chosen (nothing is asked). */
  date: string;
}) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'practitioners', 'availability', profileId, branchId, date],
    enabled: tenantId !== null && date !== '',
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/practitioners/{profileId}/availability', {
        params: { path: { profileId }, query: { branchId, date } },
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  });
}

export type NewPractitioner = components['schemas']['CreatePractitionerProfileDto'];
export type PractitionerChanges = components['schemas']['UpdatePractitionerProfileDto'];

/** A change shows in the practitioner pages and in the directory, so both are read again. */
function useRefreshPractitioners() {
  const queryClient = useQueryClient();
  return (_data: unknown, _error: unknown, { tenantId }: { tenantId: string }) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [tenantId, 'practitioners'] }),
      queryClient.invalidateQueries({ queryKey: [tenantId, 'directory'] }),
    ]);
}

/** Makes a member a practitioner, in the clinic the form was opened in. */
export function useCreatePractitioner() {
  return useMutation({
    mutationFn: async ({ body, tenantId }: { body: NewPractitioner; tenantId: string }) => {
      const result = await getApiClient().POST('/api/v1/practitioners', {
        body,
        headers: requestHeaders({ tenantId }),
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    onSettled: useRefreshPractitioners(),
  });
}

/** Edits, deactivates or reactivates a profile. There is no version: the last save wins. */
export function useUpdatePractitioner() {
  return useMutation({
    mutationFn: async ({
      profileId,
      tenantId,
      changes,
    }: {
      profileId: string;
      tenantId: string;
      changes: PractitionerChanges;
    }) => {
      const result = await getApiClient().PATCH('/api/v1/practitioners/{profileId}', {
        params: { path: { profileId } },
        body: changes,
        headers: requestHeaders({ tenantId }),
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    onSettled: useRefreshPractitioners(),
  });
}

/** Replaces the whole week. There is no version: the last save wins. */
export function useReplaceSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileId,
      tenantId,
      blocks,
    }: {
      profileId: string;
      tenantId: string;
      blocks: ScheduleBlock[];
    }) => {
      const result = await getApiClient().PUT('/api/v1/practitioners/{profileId}/schedule', {
        params: { path: { profileId } },
        body: { blocks },
        headers: requestHeaders({ tenantId }),
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    // The practitioner page shows the saved week at once; the reload that follows confirms it.
    onSuccess: (practitioner, { profileId, tenantId }) => {
      queryClient.setQueryData(detailKey({ tenantId, profileId }), practitioner);
    },
    onSettled: useRefreshPractitioners(),
  });
}
