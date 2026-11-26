import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { Button } from '@/design-system/components/button.tsx';
import { CheckboxGroup } from '@/design-system/components/choice-fields.tsx';
import { Dialog } from '@/design-system/components/dialog.tsx';
import { weekdayName } from '@/lib/datetime/wall-time.ts';

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** Which other days get a copy of one day's hours. Mounted only while open (P7-13). */
export function CopyHoursDialog({
  from,
  daysWithHours,
  onCopy,
  onClose,
}: {
  from: number;
  daysWithHours: number[];
  /** The ticked weekdays, in week order. */
  onCopy: (to: number[]) => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const [ticked, setTicked] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const source = weekdayName(from);
  const to = WEEKDAYS.filter((day) => ticked.includes(String(day)));
  const replaced = to.filter((day) => daysWithHours.includes(day)).map(weekdayName);
  const days = new Intl.ListFormat('en-PH', { type: 'conjunction' }).format(replaced);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t`Copy ${source}'s hours`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t`Cancel`}
          </Button>
          <Button
            onClick={() => {
              if (to.length === 0) setError(t`Choose at least one day.`);
              else onCopy(to);
            }}
          >
            {t`Copy hours`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <CheckboxGroup
          legend={t`Copy to`}
          error={error}
          options={WEEKDAYS.filter((day) => day !== from).map((day) => {
            const name = weekdayName(day);
            return {
              value: String(day),
              label: daysWithHours.includes(day) ? t`${name} · Has hours` : name,
            };
          })}
          value={ticked}
          onChange={(next) => {
            setTicked(next);
            setError(undefined);
          }}
        />
        {/* Always there, so that a screen reader announces the warning when it appears. */}
        <p role="status" className="font-semibold">
          {replaced.length === 0
            ? null
            : replaced.length === 1
              ? t`${days} already has hours. They will be replaced.`
              : t`${days} already have hours. They will be replaced.`}
        </p>
      </div>
    </Dialog>
  );
}
