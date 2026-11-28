import { useLingui } from '@lingui/react/macro';
import { useId } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { useAvailability } from '@/features/practitioners/api/practitioners.ts';
import { formatTime, toClinicDateTime } from '@/lib/datetime/index.ts';
import { formatWallTime } from '@/lib/datetime/wall-time.ts';

/**
 * The practitioner's working hours that day minus what is booked, as a help to pick a time. Never "the
 * only free slots": the API decides when the booking is sent (P9-15).
 */
export function FreeHours({
  profileId,
  branchId,
  date,
  onPick,
}: {
  profileId: string;
  branchId: string;
  date: string;
  /** Told the start of the pressed hours, `HH:mm` in the branch's zone. */
  onPick: (start: string) => void;
}) {
  const { t } = useLingui();
  const heading = useId();
  const hours = useAvailability({ profileId, branchId, date });

  function content() {
    if (hours.isPending) return <LoadingState label={t`Loading the hours…`} />;
    if (hours.isError) {
      const error = asApiError(hours.error);
      return (
        <ErrorState
          message={messageForError(error)}
          requestId={error.requestId}
          onRetry={() => {
            void hours.refetch();
          }}
        />
      );
    }
    const { intervals, timeZone } = hours.data;
    if (intervals.length === 0) return <p>{t`No free working hours on this day`}</p>;
    // Hours that end as the day does read "midnight", not "12:00 AM".
    const end = (iso: string): string => {
      const time = formatTime({ iso, timeZone });
      return time === '12:00 AM' ? formatWallTime('24:00') : time;
    };
    return (
      <ul className="flex flex-wrap gap-3">
        {intervals.map((interval) => (
          <li key={interval.startsAt}>
            <Button
              variant="secondary"
              onClick={() => {
                onPick(toClinicDateTime({ iso: interval.startsAt, timeZone }).time);
              }}
            >
              {`${formatTime({ iso: interval.startsAt, timeZone })} – ${end(interval.endsAt)}`}
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby={heading} className="flex flex-col gap-3">
      <h2 id={heading} className="text-h3">
        {t`Free working hours`}
      </h2>
      <p className="text-ink-secondary">{t`Booking outside these hours is allowed.`}</p>
      {content()}
    </section>
  );
}
