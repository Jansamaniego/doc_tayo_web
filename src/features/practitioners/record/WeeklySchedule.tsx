import { useLingui } from '@lingui/react/macro';

import { DetailRow } from '@/design-system/patterns/detail-row.tsx';
import { formatWallTime, weekdayName } from '@/lib/datetime/wall-time.ts';

import type { ScheduleBlock } from '../api/practitioners.ts';

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** The week, Monday first. Times are the branch's wall clock and are never converted. */
export function WeeklySchedule({
  schedule,
  branchLabel,
}: {
  schedule: ScheduleBlock[];
  /** The branch's name, with its time zone when that differs from the clinic's. */
  branchLabel: (branchId: string) => string;
}) {
  const { t } = useLingui();
  if (schedule.length === 0) return <p>{t`No weekly hours yet`}</p>;
  return (
    <dl className="flex flex-col gap-3">
      {WEEKDAYS.map((weekday) => {
        const blocks = schedule.filter((block) => block.weekday === weekday);
        return (
          <DetailRow key={weekday} label={weekdayName(weekday)}>
            {blocks.length === 0 ? (
              <span className="text-ink-secondary">{t`No hours`}</span>
            ) : (
              <ul className="flex flex-col gap-1">
                {blocks.map((block) => {
                  const start = formatWallTime(block.startsAt);
                  const end = formatWallTime(block.endsAt);
                  const branch = branchLabel(block.branchId);
                  return (
                    <li key={`${block.startsAt}-${block.branchId}`}>
                      <span aria-hidden="true">{`${start} – ${end}, ${branch}`}</span>
                      <span className="sr-only">{t`${start} to ${end} at ${branch}`}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </DetailRow>
        );
      })}
    </dl>
  );
}
