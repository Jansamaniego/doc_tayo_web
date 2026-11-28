import { useLingui } from '@lingui/react/macro';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/design-system/components/button.tsx';
import { DatePicker } from '@/design-system/components/date-fields.tsx';
import { SelectField } from '@/design-system/components/select-fields.tsx';
import type { Branch } from '@/features/clinic/api/branches.ts';
import { useDirectory } from '@/features/practitioners/api/directory.ts';
import { addDays } from '@/lib/datetime/plain-date.ts';

export function BranchPicker({
  branches,
  value,
  onChange,
}: {
  branches: Branch[];
  value: string;
  onChange: (branchId: string) => void;
}) {
  const { t } = useLingui();
  // A clinic with one branch has nothing to choose (P9-5).
  if (branches.length < 2) return null;
  return (
    <div className="md:w-80">
      <SelectField
        label={t`Branch`}
        value={value}
        options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
        onChange={onChange}
      />
    </div>
  );
}

export function DayPickerBar({
  date,
  today,
  onChange,
}: {
  date: string;
  today: string;
  onChange: (date: string) => void;
}) {
  const { t } = useLingui();
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          icon={<ChevronLeft className="size-5" />}
          onClick={() => {
            onChange(addDays({ date, days: -1 }));
          }}
        >
          {t`Previous day`}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            onChange(today);
          }}
        >
          {t`Today`}
        </Button>
        <Button
          variant="secondary"
          icon={<ChevronRight className="size-5" />}
          onClick={() => {
            onChange(addDays({ date, days: 1 }));
          }}
        >
          {t`Next day`}
        </Button>
      </div>
      <DatePicker
        legend={t`Go to a day`}
        value={date}
        onChange={(next) => {
          // '' while the typed day is incomplete: the day shown stays.
          if (next !== '') onChange(next);
        }}
      />
    </div>
  );
}

/** The clinic's active practitioners, by membership (what the day's filter takes). */
export function usePractitionerChoices({ enabled }: { enabled: boolean }) {
  const directory = useDirectory({ practitionersOnly: true, enabled });
  return {
    isLoaded: directory.isSuccess,
    choices: (directory.data ?? []).flatMap((entry) =>
      entry.practitioner
        ? [{ value: entry.membershipId, label: entry.practitioner.displayName }]
        : [],
    ),
  };
}

export function PractitionerFilter({
  choices,
  isLoaded,
  value,
  onChange,
}: {
  choices: { value: string; label: string }[];
  isLoaded: boolean;
  value: string;
  onChange: (membershipId: string) => void;
}) {
  const { t } = useLingui();
  const unlisted = value !== '' && !choices.some((choice) => choice.value === value);
  return (
    <div className="md:w-80">
      <SelectField
        label={t`Practitioner`}
        value={value}
        options={[
          { value: '', label: t`All practitioners` },
          ...choices,
          // The list is still filtered, so the control must not read "All practitioners".
          ...(unlisted
            ? [{ value, label: isLoaded ? t`Practitioner not in the list` : t`Loading…` }]
            : []),
        ]}
        onChange={onChange}
      />
    </div>
  );
}
