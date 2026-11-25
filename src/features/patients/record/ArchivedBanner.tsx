import { useLingui } from '@lingui/react/macro';

import { Alert } from '@/design-system/components/alert.tsx';
import { useClinicTimeZone } from '@/features/staff/api/clinic-time-zone.ts';
import { formatDate } from '@/lib/datetime/index.ts';

import type { Patient } from '../api/patients.ts';

/** When and why a patient was archived (the date in the clinic's zone); nothing for an active one. */
export function ArchivedBanner({ patient }: { patient: Patient }) {
  const { t } = useLingui();
  const timeZone = useClinicTimeZone();
  const { archivedAt, archiveReason } = patient;
  if (archivedAt === null) return null;
  const date = timeZone ? formatDate({ iso: archivedAt, timeZone, style: 'medium' }) : undefined;
  const reason = archiveReason ?? '';
  return (
    <Alert variant="warning">
      {date ? t`Archived on ${date}: ${reason}` : t`Archived: ${reason}`}
    </Alert>
  );
}
