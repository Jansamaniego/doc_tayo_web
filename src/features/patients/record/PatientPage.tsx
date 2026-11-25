import { useLingui } from '@lingui/react/macro';
import { Copy } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { Button } from '@/design-system/components/button.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { DetailRow } from '@/design-system/patterns/detail-row.tsx';
import { useClinicTimeZone } from '@/features/staff/api/clinic-time-zone.ts';
import { todayInZone } from '@/lib/datetime/index.ts';
import { ageOn } from '@/lib/datetime/plain-date.ts';
import { can } from '@/lib/permissions.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { usePatient, type Patient } from '../api/patients.ts';
import { birthDateWithAge } from '../birth-date.ts';
import { patientFullName } from '../patient-name.ts';
import { displayPhone } from '../phone-display.ts';
import { ArchivedBanner } from './ArchivedBanner.tsx';
import { PatientActions } from './PatientActions.tsx';
import { BackToPatients, isPatientNotFound, PatientNotFound } from './PatientNotFound.tsx';

const ADULT_AGE = 18;

function isMinor({ birthDate, today }: { birthDate: string; today: string }): boolean {
  const { unit, value } = ageOn({ birthDate, today });
  return unit === 'months' || value < ADULT_AGE;
}

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

/** The number is read out to the patient and printed on slips: large, and one press to copy. */
function PatientNumber({ number }: { number: string }) {
  const { t } = useLingui();
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
    } catch {
      // No clipboard here (an old browser, or not https): the number stays on screen to copy by hand.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-h2 font-bold">{number}</span>
      <Button
        variant="secondary"
        icon={<Copy aria-hidden="true" className="size-5" />}
        onClick={() => void copy()}
      >
        {t`Copy number`}
      </Button>
      <span role="status">{copied && t`Copied`}</span>
    </div>
  );
}

function PatientRecord({ patient }: { patient: Patient }) {
  const { t } = useLingui();
  const timeZone = useClinicTimeZone();
  const today = timeZone ? todayInZone({ timeZone }) : undefined;
  const notRecorded = t`Not recorded`;
  const sexLabel: Record<Patient['sex'], string> = {
    female: t`Female`,
    male: t`Male`,
    unknown: notRecorded,
  };
  const { birthDate, guardianName, guardianPhone } = patient;
  const session = useSession();
  const mayManage = session.status === 'signed-in' && can(session.permissions, 'patients.manage');
  const hasGuardian = guardianName !== null || guardianPhone !== null;
  const minor = birthDate !== null && today !== undefined && isMinor({ birthDate, today });
  const phone = (value: string | null) => (value ? displayPhone(value) : notRecorded);

  return (
    <div className="flex max-w-reading flex-col gap-8">
      <BackToPatients />
      <ArchivedBanner patient={patient} />

      <section aria-label={t`Patient summary`} className="flex flex-col gap-3">
        <h1 className="break-words">{patientFullName(patient)}</h1>
        <PatientNumber number={patient.patientNumber} />
        <dl className="flex flex-col gap-3">
          <DetailRow label={t`Sex`}>{sexLabel[patient.sex]}</DetailRow>
          <DetailRow label={t`Birth date`}>
            {birthDate === null ? notRecorded : birthDateWithAge({ birthDate, today })}
          </DetailRow>
        </dl>
        {mayManage && <PatientActions patient={patient} />}
      </section>

      {/* Allergies come first: staff check them before anything else. */}
      <Section title={t`Allergies`}>
        <p className="whitespace-pre-wrap break-words text-body-lg font-semibold">
          {patient.allergies ?? t`None recorded`}
        </p>
      </Section>

      <Section title={t`Contact`}>
        <dl className="flex flex-col gap-3">
          <DetailRow label={t`Phone`}>{phone(patient.phone)}</DetailRow>
          <DetailRow label={t`Email`}>{patient.email ?? notRecorded}</DetailRow>
          <DetailRow label={t`Address`}>{patient.addressLine ?? notRecorded}</DetailRow>
          <DetailRow label={t`City`}>{patient.city ?? notRecorded}</DetailRow>
          <DetailRow label={t`Province`}>{patient.province ?? notRecorded}</DetailRow>
        </dl>
      </Section>

      {(hasGuardian || minor) && (
        <Section title={t`Guardian`}>
          {hasGuardian ? (
            <dl className="flex flex-col gap-3">
              <DetailRow label={t`Name`}>{guardianName ?? notRecorded}</DetailRow>
              <DetailRow label={t`Phone`}>{phone(guardianPhone)}</DetailRow>
            </dl>
          ) : (
            <p>{t`No guardian recorded`}</p>
          )}
        </Section>
      )}

      <Section title={t`Front desk notes (not medical)`}>
        <p className="whitespace-pre-wrap break-words">{patient.notes ?? t`None recorded`}</p>
      </Section>
    </div>
  );
}

export function PatientPage({ patientId }: { patientId: string }) {
  const { t } = useLingui();
  const patient = usePatient(patientId);
  // Never the patient's name: titles stay in the history of shared computers (P6-3).
  usePageTitle(t`Patient record`);

  if (patient.isPending) return <LoadingState label={t`Loading the patient…`} />;
  if (patient.isError) {
    const error = asApiError(patient.error);
    if (isPatientNotFound(error)) return <PatientNotFound />;
    return (
      <ErrorState
        message={messageForError(error)}
        requestId={error.requestId}
        onRetry={() => {
          void patient.refetch();
        }}
      />
    );
  }
  return <PatientRecord patient={patient.data} />;
}
