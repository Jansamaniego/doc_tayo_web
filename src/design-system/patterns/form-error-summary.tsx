import { plural } from '@lingui/core/macro';
import { useEffect, useRef } from 'react';

export interface SummaryEntry {
  /** The field's `name` attribute: the link puts focus in that field. */
  name: string;
  label: string;
  message: string;
}

export interface FormErrorSummaryProps {
  errors: SummaryEntry[];
  /** Change it on every failed submit to move focus to the summary again. */
  focusKey?: number;
}

function focusField(name: string): void {
  document.querySelector<HTMLElement>(`[name="${name.replace(/["\\]/g, '\\$&')}"]`)?.focus();
}

/** At the top of a form after a failed submit: "2 things need fixing", each linked to its field. Focus moves here. */
export function FormErrorSummary({ errors, focusKey = 0 }: FormErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const count = errors.length;
  useEffect(() => {
    if (count > 0) ref.current?.focus();
  }, [count > 0, focusKey]); // eslint-disable-line react-hooks/exhaustive-deps -- refocus on each failed submit
  if (count === 0) return null;
  const heading = plural(count, { one: '# thing needs fixing', other: '# things need fixing' });
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="flex flex-col gap-2 rounded-lg border-2 border-danger-border bg-danger-bg p-4"
    >
      <h2 className="text-h3 text-danger">{heading}</h2>
      <ul className="flex flex-col gap-1">
        {errors.map((entry) => (
          <li key={`${entry.name}-${entry.message}`} className="flex flex-wrap gap-x-2">
            <a
              href={`#${entry.name}`}
              onClick={(event) => {
                event.preventDefault();
                focusField(entry.name);
              }}
              className="inline-flex min-h-target items-center font-semibold text-link"
            >
              {entry.label}
            </a>
            <span className="inline-flex items-center">{entry.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
