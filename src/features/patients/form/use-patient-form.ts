import { useLingui } from '@lingui/react/macro';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { ApiError } from '@/api/errors.ts';
import type { SummaryEntry } from '@/design-system/patterns/form-error-summary.tsx';
import { useClinicTimeZone } from '@/features/staff/api/clinic-time-zone.ts';
import { applyApiErrors } from '@/lib/api-form-errors.ts';
import { todayInZone } from '@/lib/datetime/index.ts';
import { comparePlainDates } from '@/lib/datetime/plain-date.ts';

import { MAX_LENGTHS, PATIENT_FIELDS, type PatientValues } from './patient-form-values.ts';

export const EARLIEST_BIRTH_DATE = '1900-01-01';

/**
 * What registering and editing a patient share: the values, the checks made on every press, the API's
 * field problems, and the "typed but not a date" state of the birth date.
 */
export function usePatientForm(initial: PatientValues) {
  const { t } = useLingui();
  const form = useForm<PatientValues>({ defaultValues: initial });
  const { setError, clearErrors, getValues, setValue, reset } = form;
  const timeZone = useClinicTimeZone();
  const today = timeZone ? todayInZone({ timeZone }) : undefined;
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  /** Changes when the values are replaced from outside, so the date boxes are filled afresh. */
  const [revision, setRevision] = useState(0);
  const birthIncompleteRef = useRef(false);

  const labels: Record<keyof PatientValues, string> = {
    firstName: t`First name`,
    middleName: t`Middle name`,
    lastName: t`Last name`,
    suffix: t`Suffix`,
    sex: t`Sex`,
    birthDate: t`Birth date`,
    phone: t`Phone`,
    email: t`Email`,
    addressLine: t`Address`,
    city: t`City`,
    province: t`Province`,
    guardianName: t`Guardian name`,
    guardianPhone: t`Guardian phone`,
    allergies: t`Allergies`,
    notes: t`Front desk notes (not medical)`,
  };

  function show(problems: SummaryEntry[]): void {
    for (const problem of problems) {
      setError(problem.name as keyof PatientValues, { type: 'manual', message: problem.message });
    }
    setSummary(problems);
    setAttempt((count) => count + 1);
  }

  /**
   * Checks everything again (an old error must not stay, or block). Returns the values, or undefined
   * after showing the problems. A birth date equal to `savedBirthDate` is not judged again: the API
   * accepted it (it allows tomorrow, for clinics ahead of UTC).
   */
  function validate({ savedBirthDate }: { savedBirthDate: string }): PatientValues | undefined {
    clearErrors();
    setSummary([]);
    const values = getValues();
    const problems: SummaryEntry[] = [];
    const add = (name: keyof PatientValues, message: string): void => {
      problems.push({ name, label: labels[name], message });
    };
    if (values.firstName.trim() === '') add('firstName', t`Enter the first name.`);
    if (values.lastName.trim() === '') add('lastName', t`Enter the last name.`);
    for (const [name, limit] of Object.entries(MAX_LENGTHS) as [
      keyof typeof MAX_LENGTHS,
      number,
    ][]) {
      if (values[name].trim().length > limit) {
        add(name, t`This can have at most ${limit} characters.`);
      }
    }
    const date = values.birthDate;
    if (birthIncompleteRef.current) {
      add('birthDate', t`Complete the birth date with a real date, or leave it empty.`);
    } else if (
      date !== '' &&
      date !== savedBirthDate &&
      (comparePlainDates(date, EARLIEST_BIRTH_DATE) < 0 ||
        (today !== undefined && comparePlainDates(date, today) > 0))
    ) {
      add('birthDate', t`Enter a birth date between Jan 1, 1900 and today.`);
    }
    if (problems.length === 0) return values;
    show(problems);
    return undefined;
  }

  /** Puts a `VALIDATION_FAILED` answer on its fields. False for any other error. */
  function showApiProblems(error: ApiError): boolean {
    if (error.code !== 'VALIDATION_FAILED') return false;
    const applied = applyApiErrors({ error, setError, fieldLabels: labels }).summary;
    // The API reads local phone formats; a landline or foreign number needs the country code.
    const phoneHint = t`Enter a mobile number, or start a landline or foreign number with + and the country code.`;
    const unreadable = new Set(
      error.details
        .filter(
          (detail) =>
            detail.code === 'INVALID_FORMAT' &&
            (detail.field === 'phone' || detail.field === 'guardianPhone'),
        )
        .map((detail) => detail.field),
    );
    show(
      applied.map((entry) =>
        unreadable.has(entry.name) ? { ...entry, message: phoneHint } : entry,
      ),
    );
    return true;
  }

  /**
   * Bases the form on a newer record: `saved` fills every field, then the person's own changes
   * (`mine`) go back on top, still counted as unsaved.
   */
  function rebase({ saved, mine }: { saved: PatientValues; mine: Partial<PatientValues> }): void {
    reset(saved);
    for (const name of PATIENT_FIELDS) {
      const value = mine[name];
      if (value !== undefined) setValue(name, value, { shouldDirty: true });
    }
    birthIncompleteRef.current = false;
    setRevision((count) => count + 1);
  }

  return {
    form,
    labels,
    today,
    summary,
    attempt,
    revision,
    birthIncompleteRef,
    validate,
    showApiProblems,
    rebase,
  };
}

export type PatientFormModel = ReturnType<typeof usePatientForm>;
