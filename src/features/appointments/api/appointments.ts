import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient, requestHeaders } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';
import { useActiveTenantId } from '@/api/session/session-store.ts';

export type Appointment = components['schemas']['AppointmentResponse'];

export interface DayFilters {
  /** `''` while none is chosen (nothing is asked). */
  branchId: string;
  /** `YYYY-MM-DD` in the branch's zone, or `''` while unknown (nothing is asked). */
  date: string;
  practitionerMembershipId?: string | undefined;
  /** Comma-separated statuses, as the API takes them; left out for every status. */
  status?: string | undefined;
}

/** The most the API gives in one page. */
const PAGE_SIZE = 100;
const REFRESH_MILLISECONDS = 60_000;

async function fetchWholeDay(filters: DayFilters): Promise<Appointment[]> {
  const appointments: Appointment[] = [];
  for (let page = 1; ; page += 1) {
    const result = await getApiClient().GET('/api/v1/appointments', {
      params: {
        query: {
          branchId: filters.branchId,
          date: filters.date,
          ...(filters.practitionerMembershipId && {
            practitionerMembershipId: filters.practitionerMembershipId,
          }),
          ...(filters.status && { status: filters.status }),
          page,
          pageSize: PAGE_SIZE,
        },
      },
    });
    if (!result.data) throw networkError(new Error('Empty answer.'));
    appointments.push(...result.data.data);
    if (page >= result.data.meta.totalPages) return appointments;
  }
}

/**
 * One branch's day, read whole and in the API's order, by start time
 * (plans/09-appointments.md, P9-3).
 */
export function useDayAppointments(filters: DayFilters) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'appointments', 'day', filters],
    enabled: tenantId !== null && filters.branchId !== '' && filters.date !== '',
    // The API marks appointments as never cached: nothing is kept once no screen shows it.
    gcTime: 0,
    // The front desk shares one day and the API sends no live updates (P9-4). React Query skips the
    // interval while the window is hidden and reads again when it comes back.
    refetchInterval: REFRESH_MILLISECONDS,
    refetchOnWindowFocus: 'always',
    queryFn: () => fetchWholeDay(filters),
  });
}

function useAppointmentQuery(appointmentId: string) {
  const tenantId = useActiveTenantId();
  return {
    queryKey: [tenantId, 'appointments', 'detail', appointmentId],
    enabled: tenantId !== null,
    gcTime: 0,
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/appointments/{appointmentId}', {
        params: { path: { appointmentId } },
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  };
}

export function useAppointment(appointmentId: string) {
  return useQuery(useAppointmentQuery(appointmentId));
}

/** For a form that changes what it read: always asked again, so use the data only once `isFetchedAfterMount`. */
export function useFreshAppointment(appointmentId: string) {
  return useQuery({ ...useAppointmentQuery(appointmentId), refetchOnMount: 'always' });
}

export type Booking = components['schemas']['BookAppointmentDto'];

/** Books a time or registers a walk-in, in the clinic the form was opened in. */
export function useBookAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    // The variables name a patient: not kept once the form is gone.
    gcTime: 0,
    mutationFn: async ({
      body,
      tenantId,
      idempotencyKey,
    }: {
      body: Booking;
      tenantId: string;
      idempotencyKey: string;
    }) => {
      const result = await getApiClient().POST('/api/v1/appointments', {
        body,
        headers: requestHeaders({ tenantId, idempotencyKey }),
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    // Whatever the answer: a refusal means the day or the free hours are not what the form showed.
    onSettled: (_appointment, _error, { tenantId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [tenantId, 'appointments'] }),
        queryClient.invalidateQueries({ queryKey: [tenantId, 'practitioners', 'availability'] }),
      ]),
  });
}
