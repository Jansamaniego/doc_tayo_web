import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { EmptyState, ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { useBranches, type Branch } from '@/features/clinic/api/branches.ts';
import { useClinicProfile } from '@/features/clinic/api/tenant.ts';
import { can } from '@/lib/permissions.ts';
import { useKeptForClinic, useOpenedClinic, type OpenedClinic } from '@/lib/opened-clinic.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

import type { Appointment } from '../api/appointments.ts';
import { BackToAppointments } from '../record/AppointmentNotFound.tsx';
import { BookingForm } from './BookingForm.tsx';

/** What the address may carry to fill the form. Ids only, never a name. */
export interface BookingPrefill {
  branch?: string | undefined;
  /** `YYYY-MM-DD`; a day that has passed is replaced by today. */
  date?: string | undefined;
  patient?: string | undefined;
  kind?: 'walk_in' | undefined;
}

/** The most the API gives at once: more branches than this is not a clinic this app serves. */
const ALL_BRANCHES = 100;

interface PageProps {
  prefill: BookingPrefill;
  onBooked: (appointment: Appointment) => void;
}

/** Waits for the branches and the clinic's zone: no time can be entered until the zone is known. */
function ForClinic({
  clinic,
  permissions,
  ...props
}: PageProps & { clinic: OpenedClinic; permissions: string[] }) {
  const { t } = useLingui();
  const branchList = useBranches({ pageSize: ALL_BRANCHES });
  const profile = useClinicProfile();
  const { tenantId } = clinic;
  const branches = useKeptForClinic<Branch[]>({ data: branchList.data?.data, tenantId });
  const clinicZone = useKeptForClinic({ data: profile.data?.timezone, tenantId });

  if (!branches || clinicZone === undefined) {
    const failed = branchList.isError ? branchList : profile.isError ? profile : undefined;
    if (!failed) return <LoadingState label={t`Loading the form…`} />;
    const error = asApiError(failed.error);
    return (
      <ErrorState
        message={messageForError(error)}
        requestId={error.requestId}
        onRetry={() => {
          void failed.refetch();
        }}
      />
    );
  }
  if (branches.length === 0) {
    return <EmptyState title={t`Add an active branch before booking appointments.`} />;
  }
  return (
    <BookingForm
      {...props}
      clinic={clinic}
      permissions={permissions}
      branches={branches}
      clinicZone={clinicZone}
      onBranchRefused={() => {
        void branchList.refetch();
      }}
    />
  );
}

/** Books a time or registers a walk-in (plans/09-appointments.md, 9.2). */
export function BookAppointmentPage(props: PageProps) {
  const { t } = useLingui();
  usePageTitle(t`Book an appointment`);
  const clinic = useOpenedClinic();
  const session = useSession();
  const [atOpening] = useState(() => (session.status === 'signed-in' ? session.permissions : []));
  const permissions =
    useKeptForClinic({
      data: session.status === 'signed-in' ? session.permissions : undefined,
      tenantId: clinic.tenantId,
    }) ?? atOpening;
  // Booking picks a patient, a practitioner and a service: without seeing them there is no form.
  const missing = [
    {
      permission: 'patients.read',
      reason: t`You cannot see patients, so you cannot book here.`,
    },
    {
      permission: 'directory.read',
      reason: t`You cannot see practitioners, so you cannot book here.`,
    },
    { permission: 'services.read', reason: t`You cannot see services, so you cannot book here.` },
  ].filter(({ permission }) => !can(permissions, permission));

  return (
    <div className="flex max-w-reading flex-col gap-6">
      <BackToAppointments />
      <h1>{t`Book an appointment`}</h1>
      {missing.length > 0 ? (
        missing.map(({ permission, reason }) => <p key={permission}>{reason}</p>)
      ) : (
        <ForClinic {...props} clinic={clinic} permissions={permissions} />
      )}
    </div>
  );
}
