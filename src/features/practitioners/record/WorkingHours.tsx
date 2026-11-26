import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { DatePicker } from '@/design-system/components/date-fields.tsx';
import { SelectField } from '@/design-system/components/select-fields.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { formatTime, todayInZone } from '@/lib/datetime/index.ts';
import { formatWallTime } from '@/lib/datetime/wall-time.ts';

import { useAvailability } from '../api/practitioners.ts';

export interface HoursBranch {
  id: string;
  name: string;
  /** The branch's own time zone, or the clinic's. */
  timeZone: string;
}

function DayHours({
  profileId,
  branchId,
  date,
}: {
  profileId: string;
  branchId: string;
  date: string;
}) {
  const { t } = useLingui();
  const hours = useAvailability({ profileId, branchId, date });
  if (date === '') return <p>{t`Choose a day.`}</p>;
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
  if (intervals.length === 0) return <p>{t`No working hours on this day`}</p>;
  // An interval that ends as the day does reads "midnight", not "12:00 AM".
  const end = (iso: string): string => {
    const time = formatTime({ iso, timeZone });
    return time === '12:00 AM' ? formatWallTime('24:00') : time;
  };
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1 text-body-lg font-semibold">
        {intervals.map((interval) => (
          <li key={interval.startsAt}>
            {`${formatTime({ iso: interval.startsAt, timeZone })} – ${end(interval.endsAt)}`}
          </li>
        ))}
      </ul>
      <p className="text-small text-ink-secondary">{t`Times are in ${timeZone}.`}</p>
    </div>
  );
}

/**
 * The working hours of a chosen day at a branch. It starts on today in the branch's zone. These are
 * working hours, never free appointment slots: booked appointments are not counted yet.
 */
export function WorkingHours({
  profileId,
  branches,
  isActive,
}: {
  profileId: string;
  branches: HoursBranch[];
  isActive: boolean;
}) {
  const { t } = useLingui();
  const [chosenBranch, setChosenBranch] = useState<string | undefined>();
  /** Undefined until the person picks a day: until then it follows the branch's today. */
  const [chosenDate, setChosenDate] = useState<string | undefined>();
  if (!isActive) return <p>{t`No working hours: this practitioner is inactive.`}</p>;
  const branch = branches.find((item) => item.id === chosenBranch) ?? branches[0];
  if (!branch) return <p>{t`There is no branch to show hours for.`}</p>;
  const date = chosenDate ?? todayInZone({ timeZone: branch.timeZone });

  return (
    <div className="flex flex-col gap-4">
      <div className="md:w-80">
        <SelectField
          label={t`Branch`}
          value={branch.id}
          options={branches.map((item) => ({ value: item.id, label: item.name }))}
          onChange={setChosenBranch}
        />
      </div>
      <DatePicker legend={t`Day`} value={date} onChange={setChosenDate} />
      <DayHours profileId={profileId} branchId={branch.id} date={date} />
      <p className="text-ink-secondary">{t`Booked appointments are not counted yet.`}</p>
    </div>
  );
}
