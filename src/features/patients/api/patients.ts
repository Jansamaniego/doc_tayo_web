import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiClient, requestHeaders } from '@/api/client.ts';
import { networkError } from '@/api/errors.ts';
import type { components } from '@/api/schema';
import { useActiveTenantId } from '@/api/session/session-store.ts';

export type Patient = components['schemas']['PatientResponse'];

export interface PatientFilters {
  /** A name, a patient number or a phone number: the API decides which (never put it in an address). */
  q?: string | undefined;
  includeArchived?: boolean | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

/** One patient, read in the given clinic (a form passes the clinic it was opened in). */
export async function fetchPatient({
  patientId,
  tenantId,
}: {
  patientId: string;
  tenantId?: string | undefined;
}): Promise<Patient> {
  const result = await getApiClient().GET('/api/v1/patients/{patientId}', {
    params: { path: { patientId } },
    headers: requestHeaders({ tenantId }),
  });
  if (!result.data) throw networkError(new Error('Empty answer.'));
  return result.data.data;
}

export function usePatient(patientId: string) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'patients', 'detail', patientId],
    enabled: tenantId !== null,
    gcTime: 0,
    queryFn: () => fetchPatient({ patientId }),
  });
}

export function usePatients(filters: PatientFilters) {
  const tenantId = useActiveTenantId();
  return useQuery({
    queryKey: [tenantId, 'patients', 'list', filters],
    enabled: tenantId !== null,
    // Patient data is not kept once no screen shows it (docs/clinical-integration.md).
    gcTime: 0,
    // Keep the old page on screen while the next one loads, but only within the same clinic.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0] === tenantId ? previous : undefined,
    queryFn: async () => {
      const query = {
        ...(filters.q && { q: filters.q }),
        ...(filters.includeArchived && { includeArchived: true }),
        ...(filters.page !== undefined && { page: filters.page }),
        ...(filters.pageSize !== undefined && { pageSize: filters.pageSize }),
      };
      const result = await getApiClient().GET('/api/v1/patients', { params: { query } });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data;
    },
  });
}

/** How many matches a picker offers. */
const PICKER_SIZE = 20;

/**
 * The patients a picker offers for what was typed, without archived ones. Asked in the clinic the form
 * was opened in, so a clinic switched in another tab never offers its patients.
 */
export function usePatientSearch({
  q,
  tenantId,
  enabled,
}: {
  q: string;
  tenantId: string;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: [tenantId, 'patients', 'search', q],
    enabled,
    gcTime: 0,
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/patients', {
        params: { query: { ...(q && { q }), pageSize: PICKER_SIZE } },
        headers: requestHeaders({ tenantId }),
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  });
}

/** The patient a form was opened for, read in the form's clinic. `''` asks nothing. */
export function usePatientOfForm({ patientId, tenantId }: { patientId: string; tenantId: string }) {
  return useQuery({
    queryKey: [tenantId, 'patients', 'detail', patientId],
    enabled: patientId !== '',
    gcTime: 0,
    queryFn: () => fetchPatient({ patientId, tenantId }),
  });
}

export type NewPatient = components['schemas']['CreatePatientDto'];

/** What the possible-duplicate check may be asked with: only what is filled in. */
export interface DuplicateParams {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  phone?: string;
}

/**
 * Patients that may be the person being typed in. Asked in the clinic the form was opened in. A
 * failure is silent: this check never blocks registering. `round` asks again.
 */
export function usePossibleDuplicates({
  tenantId,
  params,
  enabled,
  round,
}: {
  tenantId: string;
  params: DuplicateParams;
  enabled: boolean;
  round: number;
}) {
  return useQuery({
    queryKey: [tenantId, 'patients', 'duplicates', params, round],
    enabled,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const result = await getApiClient().GET('/api/v1/patients/possible-duplicates', {
        // The contract declares `birthDate` as an object, not text (backend request D-33): the
        // generated types refuse the string the API expects. Remove the cast when it is fixed.
        params: { query: params as never },
        headers: requestHeaders({ tenantId }),
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
  });
}

/** Registers a patient in the clinic the form was opened in; the key makes a repeat harmless. */
export function useRegisterPatient() {
  const queryClient = useQueryClient();
  return useMutation({
    // The variables are a patient's details: not kept once the form is gone.
    gcTime: 0,
    mutationFn: async ({
      body,
      tenantId,
      idempotencyKey,
    }: {
      body: NewPatient;
      tenantId: string;
      idempotencyKey: string;
    }) => {
      const result = await getApiClient().POST('/api/v1/patients', {
        body,
        headers: requestHeaders({ tenantId, idempotencyKey }),
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    onSuccess: (_patient, { tenantId }) =>
      queryClient.invalidateQueries({ queryKey: [tenantId, 'patients'] }),
  });
}

/** The fields of an edit; the version is passed beside them. */
export type PatientChanges = Omit<components['schemas']['UpdatePatientDto'], 'version'>;

/** Saves an edit in the clinic the form was opened in. A stale version is `409 VERSION_CONFLICT`. */
export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    // The variables are a patient's details: not kept once the form is gone.
    gcTime: 0,
    mutationFn: async ({
      patientId,
      tenantId,
      version,
      changes,
    }: {
      patientId: string;
      tenantId: string;
      version: number;
      changes: PatientChanges;
    }) => {
      const result = await getApiClient().PATCH('/api/v1/patients/{patientId}', {
        params: { path: { patientId } },
        body: { version, ...changes },
        headers: requestHeaders({ tenantId }),
      });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      return result.data.data;
    },
    onSuccess: (_patient, { tenantId }) =>
      queryClient.invalidateQueries({ queryKey: [tenantId, 'patients'] }),
  });
}

/**
 * Whatever the answer, the patient and the lists are read again: after a refusal someone else may
 * have archived, restored or changed the patient. The page then shows what is true.
 */
function useRefreshPatients() {
  const queryClient = useQueryClient();
  return (_data: unknown, _error: unknown, { tenantId }: { tenantId: string }) =>
    queryClient.invalidateQueries({ queryKey: [tenantId, 'patients'] });
}

/** Hides the patient from the list and search (never deleted). The reason is kept for staff. */
export function useArchivePatient() {
  return useMutation({
    gcTime: 0,
    mutationFn: async ({
      patientId,
      tenantId,
      version,
      reason,
    }: {
      patientId: string;
      tenantId: string;
      version: number;
      reason: string;
    }) => {
      await getApiClient().POST('/api/v1/patients/{patientId}/archive', {
        params: { path: { patientId } },
        body: { reason, version },
        headers: requestHeaders({ tenantId }),
      });
    },
    onSettled: useRefreshPatients(),
  });
}

/** Brings an archived patient back to the list and search. */
export function useRestorePatient() {
  return useMutation({
    gcTime: 0,
    mutationFn: async ({
      patientId,
      tenantId,
      version,
    }: {
      patientId: string;
      tenantId: string;
      version: number;
    }) => {
      await getApiClient().POST('/api/v1/patients/{patientId}/unarchive', {
        params: { path: { patientId } },
        body: { version },
        headers: requestHeaders({ tenantId }),
      });
    },
    onSettled: useRefreshPatients(),
  });
}
