import { useClinicProfile } from '@/features/clinic/api/tenant.ts';

/** The clinic's IANA time zone (`GET /tenant`), for showing dates. Undefined until it is known. */
export function useClinicTimeZone(): string | undefined {
  return useClinicProfile().data?.timezone;
}
