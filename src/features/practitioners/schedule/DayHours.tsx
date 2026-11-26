import { useLingui } from '@lingui/react/macro';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';

import { Button } from '@/design-system/components/button.tsx';
import { Checkbox } from '@/design-system/components/choice-fields.tsx';
import { TimeField } from '@/design-system/components/date-fields.tsx';
import { SelectField, type Option } from '@/design-system/components/select-fields.tsx';
import { weekdayName } from '@/lib/datetime/wall-time.ts';

import type { BlockPart, DraftBlock } from './schedule-rules.ts';

/** The `name` of a block's field, for the links of the error summary. */
export const fieldName = ({ key, part }: { key: string; part: BlockPart }): string =>
  `block-${key}-${part}`;

/** One weekday of the editor: its blocks of hours, adding one, and copying the day. */
export function DayHours({
  weekday,
  blocks,
  branchOptions,
  errorOf,
  onChange,
  onRemove,
  onAdd,
  onCopy,
}: {
  weekday: number;
  blocks: DraftBlock[];
  /** The choices for a block: the active branches, and its own one if that is no longer active. */
  branchOptions: (branchId: string) => Option[];
  errorOf: (field: string) => string | undefined;
  onChange: (block: DraftBlock) => void;
  onRemove: (key: string) => void;
  /** Absent when there is no branch to add hours at. */
  onAdd: (() => void) | undefined;
  onCopy: () => void;
}) {
  const { t } = useLingui();
  const headingId = useId();
  const day = weekdayName(weekday);

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-lg border border-divider bg-surface p-4 shadow-1 md:p-6"
    >
      <h2 id={headingId} className="text-h3">
        {day}
      </h2>
      {blocks.length === 0 && <p className="text-ink-secondary">{t`No hours`}</p>}
      {blocks.map((block, index) => {
        const number = index + 1;
        const name = t`${day}, hours ${number}`;
        const field = (part: BlockPart) => fieldName({ key: block.key, part });
        const change = (changes: Partial<DraftBlock>) => {
          onChange({ ...block, ...changes });
        };
        return (
          <div key={block.key} className="flex flex-col gap-4 border-t border-divider pt-4">
            <SelectField
              label={t`${name}: branch`}
              name={field('branchId')}
              emptyOption={t`Choose a branch`}
              options={branchOptions(block.branchId)}
              value={block.branchId}
              error={errorOf(field('branchId'))}
              onChange={(branchId) => {
                change({ branchId });
              }}
            />
            <TimeField
              legend={t`${name}: start`}
              name={field('startsAt')}
              value={block.startsAt}
              error={errorOf(field('startsAt'))}
              onChange={(startsAt) => {
                change({ startsAt });
              }}
            />
            {!block.untilMidnight && (
              <TimeField
                legend={t`${name}: end`}
                name={field('endsAt')}
                value={block.endsAt}
                error={errorOf(field('endsAt'))}
                onChange={(endsAt) => {
                  change({ endsAt });
                }}
              />
            )}
            <Checkbox
              label={t`${name}: until midnight`}
              checked={block.untilMidnight}
              onCheckedChange={(checked) => {
                change({ untilMidnight: checked === true });
              }}
            />
            <Button
              variant="danger-secondary"
              className="self-start"
              icon={<Trash2 className="size-5" />}
              onClick={() => {
                onRemove(block.key);
              }}
            >
              {t`Remove ${name}`}
            </Button>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-3">
        {onAdd && (
          <Button
            variant="secondary"
            // The summary's link for a problem with the whole week lands here.
            name={weekday === 1 ? 'week' : undefined}
            icon={<Plus className="size-5" />}
            onClick={onAdd}
          >
            {t`Add hours on ${day}`}
          </Button>
        )}
        {blocks.length > 0 && (
          <Button variant="tertiary" icon={<Copy className="size-5" />} onClick={onCopy}>
            {t`Copy ${day}'s hours to other days`}
          </Button>
        )}
      </div>
    </section>
  );
}
