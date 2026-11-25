import { useLingui } from '@lingui/react/macro';
import { TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { formatPlainDate } from '@/lib/datetime/plain-date.ts';

import { displayPhone } from '../phone-display.ts';
import type { PatientValues } from './patient-form-values.ts';

export interface TheirChange {
  field: keyof PatientValues;
  before: string;
  now: string;
  /** The person changed this field too, to something else: their value is on the form. */
  alsoMine: boolean;
}

/** "Someone else saved first": what they changed, so nothing is overwritten unseen (P6-7). */
export function VersionConflictNotice({
  changes,
  labels,
}: {
  changes: TheirChange[];
  labels: Record<keyof PatientValues, string>;
}) {
  const { t } = useLingui();
  const headingId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [changes]);

  function words({ field, value }: { field: keyof PatientValues; value: string }): string {
    if (value === '') return t`Not recorded`;
    if (field === 'birthDate') return formatPlainDate({ date: value, style: 'medium' });
    if (field === 'phone' || field === 'guardianPhone') return displayPhone(value);
    if (field === 'sex') {
      return { female: t`Female`, male: t`Male`, unknown: t`Not recorded` }[
        value as PatientValues['sex']
      ];
    }
    return value;
  }

  return (
    <div
      ref={ref}
      role="alert"
      aria-labelledby={headingId}
      tabIndex={-1}
      className="flex flex-col gap-3 rounded-lg border-2 border-warning-border bg-warning-bg p-4"
    >
      <h2 id={headingId} className="flex items-start gap-3 text-h3">
        <TriangleAlert aria-hidden="true" className="mt-1 size-6 shrink-0 text-warning" />
        {t`Someone else saved changes to this patient while you were editing`}
      </h2>
      {changes.length === 0 ? (
        <p>
          {t`None of the fields below changed, but the record did (for example it was archived or restored). Check it, then press Save again.`}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {changes.map(({ field, before, now, alsoMine }) => {
              const label = labels[field];
              const was = words({ field, value: before });
              const is = words({ field, value: now });
              return (
                <li key={field} className="whitespace-pre-wrap break-words">
                  {`${label}: ${was} → ${is}`}
                  {alsoMine && (
                    <strong className="block">
                      {t`You also changed this: your value is kept. Check it.`}
                    </strong>
                  )}
                </li>
              );
            })}
          </ul>
          <p>{t`Your changes are still in the form. Check it, then press Save again.`}</p>
        </>
      )}
    </div>
  );
}
