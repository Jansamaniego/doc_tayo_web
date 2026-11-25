import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useId, useState } from 'react';

import { StatusPill } from '@/design-system/components/badge.tsx';
import { AppLink } from '@/lib/app-link.tsx';
import { formatPlainDate } from '@/lib/datetime/plain-date.ts';

import { usePossibleDuplicates, type DuplicateParams } from '../api/patients.ts';
import { patientFullName } from '../patient-name.ts';
import { displayPhone } from '../phone-display.ts';

export type DuplicateQuery = Required<DuplicateParams>;

/** How long the person must stop typing before the check runs. */
const PAUSE_MS = 300;

function useAfterPause(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettled(value);
    }, PAUSE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [value]);
  return settled;
}

/**
 * "Is this the same person?": up to five patients who may already be the one being typed in. It never
 * blocks registering (docs/clinical-integration.md, "Possible duplicates").
 */
export function DuplicateCandidates({
  tenantId,
  query,
  round = 0,
}: {
  /** The clinic the form was opened in. */
  tenantId: string;
  query: DuplicateQuery;
  /** Change it to ask again. */
  round?: number;
}) {
  const { t } = useLingui();
  const headingId = useId();
  const firstName = useAfterPause(query.firstName.trim());
  const lastName = useAfterPause(query.lastName.trim());
  const birthDate = useAfterPause(query.birthDate);
  const phone = useAfterPause(query.phone.trim());
  const params: DuplicateParams = {
    ...(firstName && { firstName }),
    ...(lastName && { lastName }),
    ...(birthDate && { birthDate }),
    ...(phone && { phone }),
  };
  // A phone alone is enough; a similar name counts only together with the birth date.
  const enabled = phone !== '' || (firstName !== '' && lastName !== '' && birthDate !== '');
  const check = usePossibleDuplicates({ tenantId, params, enabled, round });
  const candidates = enabled ? (check.data ?? []) : [];
  const count = candidates.length;
  const reasons = {
    same_phone: t`Same phone number`,
    similar_name_same_birth_date: t`Similar name and the same birth date`,
  };

  return (
    <>
      <p role="status" className="sr-only">
        {count > 0 &&
          plural(count, {
            one: '# possible matching record',
            other: '# possible matching records',
          })}
      </p>
      {count > 0 && (
        <section
          aria-labelledby={headingId}
          className="flex flex-col gap-3 rounded-lg border-2 border-warning-border bg-warning-bg p-4"
        >
          <h2 id={headingId} className="text-h3">
            {t`Is this the same person?`}
          </h2>
          <ul className="flex flex-col gap-3">
            {candidates.map(({ patient, reason }) => {
              const name = patientFullName(patient);
              return (
                <li key={patient.id} className="flex flex-col gap-1 rounded-md bg-surface p-3">
                  <span className="break-words font-bold">{name}</span>
                  <span>{patient.patientNumber}</span>
                  {patient.birthDate && (
                    <span>{formatPlainDate({ date: patient.birthDate, style: 'medium' })}</span>
                  )}
                  {patient.phone && <span>{displayPhone(patient.phone)}</span>}
                  <span className="font-semibold">{reasons[reason]}</span>
                  {patient.archivedAt && (
                    <span>
                      <StatusPill status="neutral">{t`Archived`}</StatusPill>
                    </span>
                  )}
                  <AppLink
                    href={`/patients/${patient.id}`}
                    aria-label={t`Open record of ${name}`}
                    standalone
                  >
                    {t`Open record`}
                  </AppLink>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
