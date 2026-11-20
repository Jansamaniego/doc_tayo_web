import { useLingui } from '@lingui/react/macro';
import { Check, CircleAlert, Minus } from 'lucide-react';
import {
  Checkbox as RadixCheckbox,
  RadioGroup as RadixRadioGroup,
  Switch as RadixSwitch,
} from 'radix-ui';
import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/cn.ts';

import type { Option } from './select-fields.tsx';

const ROW = 'flex min-h-target cursor-pointer items-center gap-3';
const BOX =
  'flex size-6 shrink-0 items-center justify-center border-2 border-control bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:border-disabled-ink data-[disabled]:bg-disabled-bg';

export interface CheckboxProps {
  label: string;
  checked: boolean | 'indeterminate';
  onCheckedChange: (checked: boolean | 'indeterminate') => void;
  disabled?: boolean;
}

/** A 24 px box inside a row of at least 44 px: the whole line, label included, is the target. */
export function Checkbox({ label, checked, onCheckedChange, disabled }: CheckboxProps) {
  const id = useId();
  return (
    <label htmlFor={id} className={ROW}>
      <RadixCheckbox.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(BOX, 'rounded-sm')}
      >
        <RadixCheckbox.Indicator className="text-on-primary">
          {checked === 'indeterminate' ? (
            <Minus aria-hidden="true" className="size-4" />
          ) : (
            <Check aria-hidden="true" className="size-4" />
          )}
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <span>{label}</span>
    </label>
  );
}

interface GroupChrome {
  legend: string;
  hint?: string | undefined;
  error?: string | undefined;
}

function Message({ id, error, children }: { id: string; error?: boolean; children: ReactNode }) {
  return (
    <p
      id={id}
      className={cn(
        'text-small',
        error ? 'flex items-start gap-2 font-semibold text-danger' : 'text-ink-muted',
      )}
    >
      {error && <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

function describedBy(
  hintId: string,
  errorId: string,
  { hint, error }: GroupChrome,
): string | undefined {
  return (
    [hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') || undefined
  );
}

export interface CheckboxGroupProps extends GroupChrome {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
}

export function CheckboxGroup({
  legend,
  hint,
  error,
  options,
  value,
  onChange,
}: CheckboxGroupProps) {
  const id = useId();
  return (
    <fieldset
      aria-describedby={describedBy(`${id}-h`, `${id}-e`, { legend, hint, error })}
      className="flex flex-col gap-1"
    >
      <legend className="mb-1 text-label font-semibold">{legend}</legend>
      {hint && <Message id={`${id}-h`}>{hint}</Message>}
      {options.map((option) => (
        <Checkbox
          key={option.value}
          label={option.label}
          checked={value.includes(option.value)}
          onCheckedChange={(checked) => {
            onChange(
              checked === true
                ? [...value, option.value]
                : value.filter((item) => item !== option.value),
            );
          }}
        />
      ))}
      {error && (
        <Message id={`${id}-e`} error>
          {error}
        </Message>
      )}
    </fieldset>
  );
}

export interface RadioGroupProps extends GroupChrome {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}

export function RadioGroup({ legend, hint, error, options, value, onChange }: RadioGroupProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <p id={`${id}-l`} className="mb-1 text-label font-semibold">
        {legend}
      </p>
      {hint && <Message id={`${id}-h`}>{hint}</Message>}
      <RadixRadioGroup.Root
        value={value}
        onValueChange={onChange}
        aria-labelledby={`${id}-l`}
        aria-describedby={describedBy(`${id}-h`, `${id}-e`, { legend, hint, error })}
        className="flex flex-col"
      >
        {options.map((option) => (
          <label key={option.value} htmlFor={`${id}-${option.value}`} className={ROW}>
            <RadixRadioGroup.Item
              id={`${id}-${option.value}`}
              value={option.value}
              className={cn(BOX, 'rounded-full')}
            >
              <RadixRadioGroup.Indicator className="size-3 rounded-full bg-on-primary" />
            </RadixRadioGroup.Item>
            <span>{option.label}</span>
          </label>
        ))}
      </RadixRadioGroup.Root>
      {error && (
        <Message id={`${id}-e`} error>
          {error}
        </Message>
      )}
    </div>
  );
}

export interface SwitchProps {
  label: string;
  /** What it does: a switch is only for settings that apply immediately, so say so. */
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Switch({ label, description, checked, onCheckedChange, disabled }: SwitchProps) {
  const { t } = useLingui();
  const id = useId();
  return (
    <div className="flex min-h-target items-start gap-3 py-1">
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? `${id}-d` : undefined}
        className="relative h-11 w-20 shrink-0 rounded-full border-2 border-control bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:border-disabled-ink data-[disabled]:bg-disabled-bg"
      >
        <RadixSwitch.Thumb className="block size-7 translate-x-1.5 rounded-full bg-ink-secondary transition-transform data-[state=checked]:translate-x-10 data-[state=checked]:bg-on-primary" />
      </RadixSwitch.Root>
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="cursor-pointer font-semibold">
            {label}
          </label>
          <span aria-hidden="true" className="text-small font-semibold text-ink-secondary">
            {checked ? t`On` : t`Off`}
          </span>
        </div>
        {description && (
          <p id={`${id}-d`} className="text-small text-ink-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
