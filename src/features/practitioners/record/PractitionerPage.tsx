import { useLingui } from '@lingui/react/macro';
import { useId, type ReactNode } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { DetailRow } from '@/design-system/patterns/detail-row.tsx';
import { branchTimeZone, useBranches } from '@/features/clinic/api/branches.ts';
import { useClinicTimeZone } from '@/features/staff/api/clinic-time-zone.ts';
import { AppButtonLink } from '@/lib/app-link.tsx';
import { can } from '@/lib/permissions.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useDirectory } from '../api/directory.ts';
import { usePractitioner, type Practitioner } from '../api/practitioners.ts';
import { PractitionerActions } from './PractitionerActions.tsx';
import {
  BackToPractitioners,
  isPractitionerNotFound,
  PractitionerNotFound,
} from './PractitionerNotFound.tsx';
import { WeeklySchedule } from './WeeklySchedule.tsx';
import { WorkingHours } from './WorkingHours.tsx';

/** The most the API gives at once: more branches than this is not a clinic this app serves. */
const ALL_BRANCHES = 100;

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-lg border border-divider bg-surface p-6 shadow-1"
    >
      <h2 id={id} className="text-h3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Profile({ practitioner }: { practitioner: Practitioner }) {
  const { t } = useLingui();
  usePageTitle(practitioner.displayName);
  const session = useSession();
  const mayManage =
    session.status === 'signed-in' && can(session.permissions, 'practitioners.manage');
  const clinicZone = useClinicTimeZone();
  // Inactive branches too: an old schedule may still name one.
  const branches = useBranches({ status: 'all', pageSize: ALL_BRANCHES });
  const directory = useDirectory();
  const person = directory.data?.find((entry) => entry.membershipId === practitioner.membershipId);
  const notRecorded = t`Not recorded`;
  const all = branches.data?.data ?? [];

  const branchLabel = (branchId: string): string => {
    const branch = all.find((item) => item.id === branchId);
    if (!branch) return branches.isPending ? '…' : t`Unknown branch`;
    const ownZone = branch.timezone !== null && branch.timezone !== clinicZone;
    return ownZone ? `${branch.name} (${branch.timezone ?? ''})` : branch.name;
  };

  // The branches the schedule names; with no schedule, every active branch.
  const scheduled = new Set(practitioner.schedule.map((block) => block.branchId));
  const offered = all.filter((branch) =>
    scheduled.size > 0 ? scheduled.has(branch.id) : branch.isActive,
  );

  return (
    <div className="flex max-w-reading flex-col gap-8">
      <BackToPractitioners />
      {!practitioner.isActive && (
        <Alert variant="warning">{t`This practitioner is inactive.`}</Alert>
      )}
      <div className="flex flex-col gap-4">
        <h1 className="break-words">{practitioner.displayName}</h1>
        <dl className="flex flex-col gap-3">
          <DetailRow label={t`Specialization`}>
            {practitioner.specialization ?? notRecorded}
          </DetailRow>
          <DetailRow label={t`PRC license number`}>
            {practitioner.prcLicenseNumber ?? notRecorded}
          </DetailRow>
          <DetailRow label={t`PTR number`}>{practitioner.ptrNumber ?? notRecorded}</DetailRow>
          <DetailRow label={t`Staff member`}>
            {person
              ? [person.fullName, person.jobTitle].filter(Boolean).join(' · ')
              : directory.data
                ? t`Not active staff at the moment`
                : ''}
          </DetailRow>
        </dl>
        {mayManage && <PractitionerActions practitioner={practitioner} />}
      </div>

      <Section title={t`Weekly schedule`}>
        <WeeklySchedule schedule={practitioner.schedule} branchLabel={branchLabel} />
        {mayManage && (
          <div>
            <AppButtonLink href={`/practitioners/${practitioner.id}/schedule`} variant="secondary">
              {t`Edit weekly schedule`}
            </AppButtonLink>
          </div>
        )}
      </Section>

      <Section title={t`Working hours on a day`}>
        {branches.isError ? (
          <ErrorState
            message={messageForError(asApiError(branches.error))}
            requestId={asApiError(branches.error).requestId}
            onRetry={() => {
              void branches.refetch();
            }}
          />
        ) : branches.data && clinicZone ? (
          <WorkingHours
            profileId={practitioner.id}
            isActive={practitioner.isActive}
            branches={offered.map((branch) => ({
              id: branch.id,
              name: branch.name,
              timeZone: branchTimeZone({ branch, clinicZone }),
            }))}
          />
        ) : (
          <LoadingState label={t`Loading the hours…`} />
        )}
      </Section>
    </div>
  );
}

export function PractitionerPage({ profileId }: { profileId: string }) {
  const { t } = useLingui();
  const practitioner = usePractitioner(profileId);

  if (practitioner.isPending) return <LoadingState label={t`Loading the practitioner…`} />;
  if (practitioner.isError) {
    const error = asApiError(practitioner.error);
    if (isPractitionerNotFound(error)) return <PractitionerNotFound />;
    return (
      <ErrorState
        message={messageForError(error)}
        requestId={error.requestId}
        onRetry={() => {
          void practitioner.refetch();
        }}
      />
    );
  }
  return <Profile practitioner={practitioner.data} />;
}
