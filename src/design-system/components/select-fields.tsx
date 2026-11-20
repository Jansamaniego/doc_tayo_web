import { useLingui } from '@lingui/react/macro';
import { Check, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn.ts';

import { controlClass, Field, type FieldProps } from './field.tsx';

export interface Option {
  value: string;
  label: string;
}

type FieldChrome = Pick<FieldProps, 'label' | 'hint' | 'error' | 'optional'>;

export interface SelectFieldProps extends FieldChrome {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  /** An explicit first choice such as "Choose a branch" (used instead of a placeholder). */
  emptyOption?: string;
  disabled?: boolean;
}

/**
 * A styled native select: the easiest control for older users, and it opens the phone's own picker.
 * Use it for lists under about 15 options; use Combobox for longer ones.
 */
export function SelectField({
  label,
  hint,
  error,
  optional,
  options,
  value,
  onChange,
  emptyOption,
  disabled,
}: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      {(control) => (
        <div className="relative">
          <select
            {...control}
            value={value}
            disabled={disabled}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            className={cn(controlClass({ invalid: !!error }), 'appearance-none pr-12')}
          >
            {emptyOption !== undefined && <option value="">{emptyOption}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2"
          />
        </div>
      )}
    </Field>
  );
}

export interface ComboboxProps extends FieldChrome {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * A searchable list for long lists (branches, doctors, ICD-10 later). A button opens a popover with a
 * search box and a listbox; the number of results is announced. Needs the NVDA + VoiceOver check
 * recorded in plans/02-design-system.md §15a.
 */
export function Combobox({
  label,
  hint,
  error,
  optional,
  options,
  value,
  onChange,
  disabled,
}: ComboboxProps) {
  const { t } = useLingui();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? options.filter((option) => option.label.toLowerCase().includes(needle))
      : options;
  }, [options, query]);
  const selected = options.find((option) => option.value === value);

  function choose(option: Option): void {
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, shown.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = shown[active];
      if (option) choose(option);
    }
  }

  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      {(control) => (
        <Popover.Root
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) {
              setQuery('');
              setActive(
                Math.max(
                  0,
                  options.findIndex((option) => option.value === value),
                ),
              );
            }
          }}
        >
          <Popover.Trigger asChild>
            <button
              {...control}
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={listId}
              disabled={disabled}
              className={cn(
                controlClass({ invalid: !!error }),
                'flex items-center justify-between gap-3 text-left',
              )}
            >
              <span>{selected ? selected.label : t`Choose an option`}</span>
              <ChevronsUpDown aria-hidden="true" className="size-5 shrink-0" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              aria-label={label}
              align="start"
              sideOffset={4}
              className="z-50 flex w-(--radix-popover-trigger-width) min-w-64 flex-col gap-2 rounded-lg border border-divider bg-surface p-3 shadow-2"
            >
              <input
                type="search"
                aria-label={t`Search`}
                aria-controls={listId}
                aria-activedescendant={
                  shown[active] ? `${listId}-${shown[active].value}` : undefined
                }
                autoComplete="off"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={handleKeyDown}
                className={cn(controlClass(), '[&::-webkit-search-cancel-button]:hidden')}
              />
              <p aria-live="polite" className="text-small text-ink-muted">
                {shown.length === 0 ? t`No results` : t`${shown.length} results`}
              </p>
              <div
                id={listId}
                role="listbox"
                aria-label={label}
                className="flex max-h-72 flex-col overflow-y-auto"
              >
                {shown.map((option, index) => (
                  <div
                    key={option.value}
                    id={`${listId}-${option.value}`}
                    role="option"
                    tabIndex={-1}
                    aria-selected={option.value === value}
                    onClick={() => {
                      choose(option);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        choose(option);
                      }
                    }}
                    onMouseMove={() => {
                      setActive(index);
                    }}
                    className={cn(
                      'flex min-h-target cursor-pointer items-center justify-between gap-3 rounded-md px-3',
                      index === active && 'bg-selected',
                    )}
                  >
                    <span>{option.label}</span>
                    {option.value === value && (
                      <Check aria-hidden="true" className="size-5 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </Field>
  );
}
