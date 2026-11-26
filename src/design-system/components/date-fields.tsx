import { useLingui } from '@lingui/react/macro';
import { CalendarDays, CircleAlert } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useId, useState, type ReactNode } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

import { cn } from '@/lib/cn.ts';
import {
  comparePlainDates,
  formatPlainDate,
  localDateToPlainDate,
  parsePlainDate,
  plainDateToLocalDate,
  toPlainDate,
} from '@/lib/datetime/plain-date.ts';

import { Button } from './button.tsx';
import { controlClass } from './field.tsx';

const MONTHS = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat('en-PH', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, index, 1)),
  ),
);

interface PartsChrome {
  legend: string;
  hint?: string | undefined;
  error?: string | undefined;
  optional?: boolean | undefined;
  disabled?: boolean | undefined;
}

/** A group (fieldset + legend) of separately labelled parts, with hint and error linked to every part. */
function PartsGroup({
  legend,
  hint,
  error,
  optional,
  children,
}: PartsChrome & {
  children: (describedBy: string | undefined, invalid: true | undefined) => ReactNode;
}) {
  const { t } = useLingui();
  const id = useId();
  const describedBy =
    [hint ? `${id}-h` : undefined, error ? `${id}-e` : undefined].filter(Boolean).join(' ') ||
    undefined;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-label font-semibold">
        {legend}
        {optional && <span className="ml-2 font-normal text-ink-muted">{t`Optional`}</span>}
      </legend>
      {hint && (
        <p id={`${id}-h`} className="text-small text-ink-muted">
          {hint}
        </p>
      )}
      {children(describedBy, error ? true : undefined)}
      {error && (
        <p id={`${id}-e`} className="flex items-start gap-2 text-small font-semibold text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}

function Part({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-small font-semibold text-ink-secondary">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

const digits = (value: string): string => value.replace(/\D/g, '');

export interface DateFieldProps extends PartsChrome {
  /** `YYYY-MM-DD`, or '' while empty or incomplete. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest and latest allowed date, `YYYY-MM-DD`. */
  min?: string | undefined;
  max?: string | undefined;
  /**
   * True while something is typed that is not a real date. `value` is '' then, so a form that must not
   * silently drop a half-typed date needs this.
   */
  onIncompleteChange?: ((incomplete: boolean) => void) | undefined;
  /** Rendered after the parts (the DatePicker puts its calendar button here). */
  trailing?: ReactNode;
}

interface DateParts {
  month: string;
  day: string;
  year: string;
}

function partsOf(value: string): DateParts {
  const parsed = parsePlainDate(value);
  return parsed
    ? { month: String(parsed.month), day: String(parsed.day), year: String(parsed.year) }
    : { month: '', day: '', year: '' };
}

function dateOf({ month, day, year }: DateParts): string {
  if (!month || !day || year.length !== 4) return '';
  const candidate = toPlainDate({ year: Number(year), month: Number(month), day: Number(day) });
  return parsePlainDate(candidate) ? candidate : '';
}

/**
 * Month (by name), day and year as three labelled parts: typing always works, the calendar is optional.
 * It deals in plain calendar dates only; no time zone. Never erases what was typed.
 */
export function DateField({
  legend,
  hint,
  error,
  optional,
  disabled,
  value,
  onChange,
  min,
  max,
  onIncompleteChange,
  trailing,
}: DateFieldProps) {
  const { t } = useLingui();
  const [parts, setParts] = useState<DateParts>(() => partsOf(value));

  // A value set from outside (a reset, a loaded record, the calendar) replaces the parts; our own
  // "" while incomplete does not. (Adjusting state while rendering, as React recommends.)
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== '' && value !== dateOf(parts)) setParts(partsOf(value));
  }

  function update(next: DateParts): void {
    setParts(next);
    const date = dateOf(next);
    onChange(date);
    onIncompleteChange?.(date === '' && Object.values(next).some((part) => part !== ''));
  }

  const complete = !!parts.month && !!parts.day && parts.year.length === 4;
  const date = dateOf(parts);
  let internal: string | undefined;
  if (complete && !date) internal = t`That date does not exist.`;
  else if (date && min && comparePlainDates(date, min) < 0) {
    const limit = formatPlainDate({ date: min, style: 'medium' });
    internal = t`Choose a date on or after ${limit}.`;
  } else if (date && max && comparePlainDates(date, max) > 0) {
    const limit = formatPlainDate({ date: max, style: 'medium' });
    internal = t`Choose a date on or before ${limit}.`;
  }

  return (
    <PartsGroup legend={legend} hint={hint} error={internal ?? error} optional={optional}>
      {(describedBy, invalid) => (
        <div className="flex flex-wrap items-end gap-3">
          <Part label={t`Month`}>
            {(id) => (
              <select
                id={id}
                disabled={disabled}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                value={parts.month}
                onChange={(event) => {
                  update({ ...parts, month: event.target.value });
                }}
                className={cn(controlClass({ invalid: !!invalid }), 'w-44')}
              >
                <option value="" />
                {MONTHS.map((name, index) => (
                  <option key={name} value={String(index + 1)}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </Part>
          <Part label={t`Day`}>
            {(id) => (
              <input
                id={id}
                disabled={disabled}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                inputMode="numeric"
                autoComplete="off"
                maxLength={2}
                value={parts.day}
                onChange={(event) => {
                  update({ ...parts, day: digits(event.target.value) });
                }}
                className={cn(
                  controlClass({ invalid: !!invalid }),
                  'w-20 text-center tabular-nums',
                )}
              />
            )}
          </Part>
          <Part label={t`Year`}>
            {(id) => (
              <input
                id={id}
                disabled={disabled}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={parts.year}
                onChange={(event) => {
                  update({ ...parts, year: digits(event.target.value) });
                }}
                className={cn(
                  controlClass({ invalid: !!invalid }),
                  'w-28 text-center tabular-nums',
                )}
              />
            )}
          </Part>
          {trailing}
        </div>
      )}
    </PartsGroup>
  );
}

export type DatePickerProps = DateFieldProps;

const DAY_NAME = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** The typed DateField plus an optional calendar. The calendar is a convenience, never the only way. */
export function DatePicker(props: DatePickerProps) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  // A day button shows "25", so its name must say "25" too ("25th" would not match what is seen, and
  // voice control could not press it): "Wednesday, November 25, 2026".
  function dayName(
    date: Date,
    { today, selected }: { today?: boolean; selected?: boolean },
  ): string {
    const day = DAY_NAME.format(
      new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
    );
    const named = today ? t`Today, ${day}` : day;
    return selected ? t`${named}, selected` : named;
  }
  const selected = parsePlainDate(props.value) ? plainDateToLocalDate(props.value) : undefined;
  return (
    <DateField
      {...props}
      trailing={
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <Button
              variant="secondary"
              icon={<CalendarDays className="size-5" />}
              disabled={props.disabled}
            >
              {t`Choose on calendar`}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              aria-label={t`Choose a date`}
              align="start"
              sideOffset={4}
              className="z-50 rounded-lg border border-divider bg-surface p-3 shadow-2 [--rdp-accent-background-color:var(--color-selected)] [--rdp-accent-color:var(--color-primary)] [--rdp-day-height:3rem] [--rdp-day-width:3rem] [--rdp-day_button-height:2.75rem] [--rdp-day_button-width:2.75rem] [--rdp-nav_button-height:2.75rem] [--rdp-nav_button-width:2.75rem] [--rdp-today-color:var(--color-primary)]"
            >
              <DayPicker
                mode="single"
                labels={{ labelDayButton: dayName }}
                {...(selected && { selected, defaultMonth: selected })}
                onSelect={(date) => {
                  if (date) {
                    props.onChange(localDateToPlainDate(date));
                    setOpen(false);
                  }
                }}
                disabled={[
                  ...(props.min ? [{ before: plainDateToLocalDate(props.min) }] : []),
                  ...(props.max ? [{ after: plainDateToLocalDate(props.max) }] : []),
                ]}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      }
    />
  );
}

export interface TimeFieldProps extends PartsChrome {
  /** 24-hour `HH:mm`, or '' while empty or incomplete. */
  value: string;
  onChange: (value: string) => void;
  /** Minutes are offered in steps of this many (default 5). A minute already set is always kept. */
  minuteStep?: number | undefined;
  /** Put on the hour, so that a link in a form's error summary can focus the field. */
  name?: string | undefined;
}

interface TimeParts {
  hour: string;
  minute: string;
  period: '' | 'AM' | 'PM';
}

function timePartsOf(value: string): TimeParts {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return { hour: '', minute: '', period: '' };
  const hour24 = Number(match[1]);
  return {
    hour: String(hour24 % 12 || 12),
    minute: match[2] ?? '',
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
}

function timeOf({ hour, minute, period }: TimeParts): string {
  if (!hour || !minute || !period) return '';
  const hour24 = (Number(hour) % 12) + (period === 'PM' ? 12 : 0);
  return `${String(hour24).padStart(2, '0')}:${minute}`;
}

/** Hour, minute and AM/PM as labelled selects on a 12-hour clock. */
export function TimeField({
  legend,
  hint,
  error,
  optional,
  disabled,
  value,
  onChange,
  minuteStep = 5,
  name,
}: TimeFieldProps) {
  const { t } = useLingui();
  const [parts, setParts] = useState<TimeParts>(() => timePartsOf(value));
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== '' && value !== timeOf(parts)) setParts(timePartsOf(value));
  }

  function update(next: TimeParts): void {
    setParts(next);
    onChange(timeOf(next));
  }

  const minutes = new Set<string>();
  for (let minute = 0; minute < 60; minute += minuteStep)
    minutes.add(String(minute).padStart(2, '0'));
  if (parts.minute) minutes.add(parts.minute);
  const sortedMinutes = [...minutes].sort();

  const select = (
    id: string,
    current: string,
    set: (next: string) => void,
    invalid: true | undefined,
    describedBy: string | undefined,
    options: ReactNode,
    fieldName?: string,
  ): ReactNode => (
    <select
      id={id}
      name={fieldName}
      disabled={disabled}
      aria-describedby={describedBy}
      aria-invalid={invalid}
      value={current}
      onChange={(event) => {
        set(event.target.value);
      }}
      className={cn(controlClass({ invalid: !!invalid }), 'w-28')}
    >
      <option value="" />
      {options}
    </select>
  );

  return (
    <PartsGroup legend={legend} hint={hint} error={error} optional={optional}>
      {(describedBy, invalid) => (
        <div className="flex flex-wrap items-end gap-3">
          <Part label={t`Hour`}>
            {(id) =>
              select(
                id,
                parts.hour,
                (hour) => {
                  update({ ...parts, hour });
                },
                invalid,
                describedBy,
                Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={String(index + 1)}>
                    {index + 1}
                  </option>
                )),
                name,
              )
            }
          </Part>
          <Part label={t`Minute`}>
            {(id) =>
              select(
                id,
                parts.minute,
                (minute) => {
                  update({ ...parts, minute });
                },
                invalid,
                describedBy,
                sortedMinutes.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                )),
              )
            }
          </Part>
          <Part label={t`AM or PM`}>
            {(id) =>
              select(
                id,
                parts.period,
                (period) => {
                  update({ ...parts, period: period as TimeParts['period'] });
                },
                invalid,
                describedBy,
                <>
                  <option value="AM">{t`AM`}</option>
                  <option value="PM">{t`PM`}</option>
                </>,
              )
            }
          </Part>
        </div>
      )}
    </PartsGroup>
  );
}

export interface DateRangePickerProps {
  legend: string;
  value: { from: string; to: string };
  onChange: (value: { from: string; to: string }) => void;
  min?: string;
  max?: string;
}

/** Two dates, From and To. Says in words when the end is before the start. */
export function DateRangePicker({ legend, value, onChange, min, max }: DateRangePickerProps) {
  const { t } = useLingui();
  const reversed = !!value.from && !!value.to && comparePlainDates(value.to, value.from) < 0;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-label font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-6">
        <DatePicker
          legend={t`From`}
          value={value.from}
          min={min}
          max={max}
          onChange={(from) => {
            onChange({ ...value, from });
          }}
        />
        <DatePicker
          legend={t`To`}
          value={value.to}
          min={min}
          max={max}
          error={reversed ? t`The end date must be on or after the start date.` : undefined}
          onChange={(to) => {
            onChange({ ...value, to });
          }}
        />
      </div>
    </fieldset>
  );
}
