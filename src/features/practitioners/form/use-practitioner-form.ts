import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import type { ApiError } from '@/api/errors.ts';
import type { SummaryEntry } from '@/design-system/patterns/form-error-summary.tsx';
import { applyApiErrors } from '@/lib/api-form-errors.ts';

import { MAX_LENGTHS, type PractitionerValues } from './practitioner-form-values.ts';

/** What adding and editing a practitioner share: the fields, their checks and the API's problems. */
export function usePractitionerForm(initial: PractitionerValues) {
  const { t } = useLingui();
  const form = useForm<PractitionerValues>({ defaultValues: initial });
  const { setError, clearErrors, getValues } = form;
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const labels: Record<keyof PractitionerValues, string> = {
    displayName: t`Display name`,
    specialization: t`Specialization`,
    prcLicenseNumber: t`PRC license number`,
    ptrNumber: t`PTR number`,
  };

  /** Shows problems; those of a profile field are put under it too. */
  function show(problems: SummaryEntry[]): void {
    for (const problem of problems) {
      if (problem.name in labels) {
        setError(problem.name as keyof PractitionerValues, {
          type: 'manual',
          message: problem.message,
        });
      }
    }
    setSummary(problems);
    setAttempt((count) => count + 1);
  }

  /** Checks everything again. Returns the values and the problems (none means it may be sent). */
  function check(): { values: PractitionerValues; problems: SummaryEntry[] } {
    clearErrors();
    setSummary([]);
    const values = getValues();
    const problems: SummaryEntry[] = [];
    const add = (name: keyof PractitionerValues, message: string): void => {
      problems.push({ name, label: labels[name], message });
    };
    if (values.displayName.trim() === '') add('displayName', t`Enter how the name is printed.`);
    for (const [name, limit] of Object.entries(MAX_LENGTHS) as [
      keyof PractitionerValues,
      number,
    ][]) {
      if (values[name].trim().length > limit) {
        add(name, t`This can have at most ${limit} characters.`);
      }
    }
    return { values, problems };
  }

  /** Puts a `VALIDATION_FAILED` answer on its fields. False for any other error. */
  function showApiProblems(error: ApiError): boolean {
    if (error.code !== 'VALIDATION_FAILED') return false;
    show(applyApiErrors({ error, setError, fieldLabels: labels }).summary);
    return true;
  }

  return { form, labels, summary, attempt, show, check, showApiProblems };
}

export type PractitionerFormModel = ReturnType<typeof usePractitionerForm>;
