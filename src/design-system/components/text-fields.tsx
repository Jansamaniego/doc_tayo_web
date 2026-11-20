import { useLingui } from '@lingui/react/macro';
import { Search, X } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type Ref,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/cn.ts';

import { Button } from './button.tsx';
import { controlClass, Field, type FieldProps } from './field.tsx';

type FieldChrome = Pick<FieldProps, 'label' | 'hint' | 'error' | 'optional'>;

// Placeholders are not part of the design system: examples go in the hint.
export interface TextFieldProps
  extends FieldChrome, Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder' | 'id'> {
  /** For form libraries such as react-hook-form (`{...register('name')}`). */
  ref?: Ref<HTMLInputElement>;
}

export function TextField({ label, hint, error, optional, className, ...input }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      {(control) => (
        <input
          {...control}
          {...input}
          className={cn(controlClass({ invalid: !!error, readOnly: input.readOnly }), className)}
        />
      )}
    </Field>
  );
}

export interface TextAreaProps
  extends FieldChrome, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'placeholder' | 'id'> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextArea({
  label,
  hint,
  error,
  optional,
  className,
  maxLength,
  onChange,
  ...area
}: TextAreaProps) {
  const { t } = useLingui();
  const [typedLength, setTypedLength] = useState(String(area.defaultValue ?? '').length);
  const length = area.value === undefined ? typedLength : String(area.value).length;
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      {(control) => (
        <>
          <textarea
            {...control}
            {...area}
            maxLength={maxLength}
            onChange={(event) => {
              setTypedLength(event.target.value.length);
              onChange?.(event);
            }}
            className={cn(
              controlClass({ invalid: !!error }),
              'field-sizing-content min-h-24 py-3',
              className,
            )}
          />
          {maxLength !== undefined && (
            <p className="text-small text-ink-muted">{t`${length} of ${maxLength} characters`}</p>
          )}
        </>
      )}
    </Field>
  );
}

export interface PasswordRule {
  text: string;
  met: boolean;
}

export interface PasswordFieldProps extends TextFieldProps {
  /** Rules shown as a list, each checked live where the client can know the answer. */
  rules?: PasswordRule[];
}

export function PasswordField({
  rules,
  label,
  hint,
  error,
  optional,
  className,
  ...input
}: PasswordFieldProps) {
  const { t } = useLingui();
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} hint={hint} error={error} optional={optional}>
      {(control) => (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              {...control}
              {...input}
              type={shown ? 'text' : 'password'}
              className={cn(controlClass({ invalid: !!error }), 'min-w-48 flex-1', className)}
            />
            <Button
              variant="secondary"
              aria-pressed={shown}
              onClick={() => {
                setShown((current) => !current);
              }}
            >
              {shown ? t`Hide password` : t`Show password`}
            </Button>
          </div>
          {rules && (
            <ul className="flex flex-col gap-1 text-small">
              {rules.map((rule) => (
                <li key={rule.text} className="flex gap-2">
                  <span aria-hidden="true">{rule.met ? '✓' : '○'}</span>
                  <span>{rule.text}</span>
                  <span className={rule.met ? 'font-semibold text-success' : 'text-ink-muted'}>
                    {rule.met ? t`Done` : t`Not yet`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Field>
  );
}

const AMOUNT = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `1,250.5` -> 125050 centavos; '' -> null; anything else -> 'invalid'. No floating-point money. */
function parseAmount(text: string): number | null | 'invalid' {
  const clean = text.trim().replaceAll(',', '');
  if (clean === '') return null;
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(clean);
  if (!match || (match[1] === '' && !match[2])) return 'invalid';
  return Number(match[1] ?? '0') * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

export interface MoneyFieldProps extends FieldChrome {
  /** Whole centavos, or null when empty or not a valid amount. */
  value: number | null;
  onChange: (centavos: number | null) => void;
  disabled?: boolean;
}

export function MoneyField({
  label,
  hint,
  error,
  optional,
  value,
  onChange,
  disabled,
}: MoneyFieldProps) {
  const { t } = useLingui();
  const [text, setText] = useState(value === null ? '' : AMOUNT.format(value / 100));
  const parsed = parseAmount(text);

  // A change made elsewhere (a reset, a loaded record) replaces the text; typing never does.
  const [seenValue, setSeenValue] = useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    if (parsed !== 'invalid' && parsed !== value)
      setText(value === null ? '' : AMOUNT.format(value / 100));
  }

  const message =
    error ?? (parsed === 'invalid' ? t`Enter an amount, for example 1,250.50.` : undefined);
  return (
    <Field label={label} hint={hint} error={message} optional={optional}>
      {(control) => (
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-semibold"
          >
            ₱
          </span>
          <input
            {...control}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              const next = parseAmount(event.target.value);
              onChange(next === 'invalid' ? null : next);
            }}
            onBlur={() => {
              if (parsed !== 'invalid' && parsed !== null) setText(AMOUNT.format(parsed / 100));
            }}
            className={cn(controlClass({ invalid: !!message }), 'pl-10')}
          />
        </div>
      )}
    </Field>
  );
}

export interface SearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called 300 ms after typing stops, on Enter, and when the field is cleared. */
  onSearch: (value: string) => void;
  /** For example "12 patients found": announced politely to screen readers. */
  resultSummary?: string;
}

export function SearchField({ label, value, onChange, onSearch, resultSummary }: SearchFieldProps) {
  const { t } = useLingui();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const lastSearched = useRef(value);

  useEffect(() => {
    if (value === lastSearched.current) return;
    timer.current = window.setTimeout(() => {
      lastSearched.current = value;
      onSearch(value);
    }, 300);
    return () => {
      window.clearTimeout(timer.current);
    };
  }, [value, onSearch]);

  function searchNow(next: string): void {
    window.clearTimeout(timer.current);
    lastSearched.current = next;
    onSearch(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchNow(value);
    }
  }

  return (
    <Field label={label}>
      {(control) => (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
              />
              <input
                {...control}
                ref={inputRef}
                type="search"
                value={value}
                autoComplete="off"
                onChange={(event) => {
                  onChange(event.target.value);
                }}
                onKeyDown={handleKeyDown}
                className={cn(controlClass(), 'pl-12 [&::-webkit-search-cancel-button]:hidden')}
              />
            </div>
            {value && (
              <Button
                variant="tertiary"
                icon={<X className="size-5" />}
                onClick={() => {
                  onChange('');
                  searchNow('');
                  inputRef.current?.focus();
                }}
              >
                {t`Clear`}
              </Button>
            )}
          </div>
          <p aria-live="polite" className="min-h-6 text-small text-ink-muted">
            {resultSummary}
          </p>
        </>
      )}
    </Field>
  );
}
