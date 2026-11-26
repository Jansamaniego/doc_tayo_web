import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { asApiError, type ApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { Combobox } from '@/design-system/components/select-fields.tsx';
import { TextField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { applyApiErrors } from '@/lib/api-form-errors.ts';
import { timeZoneOptions } from '@/lib/datetime/index.ts';

import { useClinicProfile } from '../api/tenant.ts';
import type { Branch } from '../api/branches.ts';

/** What was typed, trimmed. An empty `timezone` means "the clinic's". */
export interface BranchFormValues {
  name: string;
  addressLine: string;
  city: string;
  province: string;
  timezone: string;
}

/** `nothing-to-change` is for an edit where every field is as it was. */
export type BranchSubmitResult = 'saved' | 'nothing-to-change';

const MAX_NAME = 120;
const MAX_ADDRESS = 200;
const MAX_PLACE = 120;

/**
 * The branch fields, shared by "add" and "edit". It checks what it can before sending, then hands the
 * values to `onSubmit`, which sends them and may throw the API's error: a field problem or a name
 * already taken is shown under its field, anything else goes to the page (`onFailed`).
 */
export function BranchForm({
  branch,
  submitLabel,
  savingLabel,
  onSubmit,
  onFailed,
  onCancel,
}: {
  /** Present when editing: the form starts from it. */
  branch?: Branch;
  submitLabel: string;
  savingLabel: string;
  onSubmit: (values: BranchFormValues) => Promise<BranchSubmitResult>;
  onFailed: (error: ApiError) => void;
  onCancel?: () => void;
}) {
  const { t } = useLingui();
  const clinicTimeZone = useClinicProfile().data?.timezone;
  const { register, handleSubmit, setError, formState } = useForm<
    Omit<BranchFormValues, 'timezone'>
  >({
    defaultValues: {
      name: branch?.name ?? '',
      addressLine: branch?.addressLine ?? '',
      city: branch?.city ?? '',
      province: branch?.province ?? '',
    },
  });
  const [timezone, setTimezone] = useState(branch?.timezone ?? '');
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [nothingToChange, setNothingToChange] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const labels = {
    name: t`Branch name`,
    addressLine: t`Address`,
    city: t`City`,
    province: t`Province`,
    timezone: t`Time zone`,
  };
  const clinicsOwnZone = clinicTimeZone
    ? t`Clinic's time zone (${clinicTimeZone})`
    : t`Clinic's time zone`;
  const zoneOptions = [{ value: '', label: clinicsOwnZone }, ...timeZoneOptions()];

  function showProblems(problems: SummaryEntry[]): void {
    for (const problem of problems) {
      setError(problem.name as keyof Omit<BranchFormValues, 'timezone'>, {
        type: 'server',
        message: problem.message,
      });
    }
    setSummary(problems);
    setAttempt((count) => count + 1);
  }

  async function submit(typed: Omit<BranchFormValues, 'timezone'>): Promise<void> {
    setNothingToChange(false);
    const values: BranchFormValues = {
      name: typed.name.trim(),
      addressLine: typed.addressLine.trim(),
      city: typed.city.trim(),
      province: typed.province.trim(),
      timezone,
    };
    const problems: SummaryEntry[] = [];
    const reject = (field: keyof Omit<BranchFormValues, 'timezone'>, message: string): void => {
      problems.push({ name: field, label: labels[field], message });
    };
    if (values.name === '') reject('name', t`Enter the branch name.`);
    else if (values.name.length > MAX_NAME) reject('name', t`Use at most 120 characters.`);
    if (values.addressLine.length > MAX_ADDRESS) {
      reject('addressLine', t`Use at most 200 characters.`);
    }
    if (values.city.length > MAX_PLACE) reject('city', t`Use at most 120 characters.`);
    if (values.province.length > MAX_PLACE) reject('province', t`Use at most 120 characters.`);
    if (problems.length > 0) {
      showProblems(problems);
      return;
    }
    setSummary([]);

    setIsSaving(true);
    try {
      if ((await onSubmit(values)) === 'nothing-to-change') setNothingToChange(true);
    } catch (error) {
      const apiError = asApiError(error);
      if (apiError.code === 'VALIDATION_FAILED') {
        setSummary(applyApiErrors({ error: apiError, setError, fieldLabels: labels }).summary);
        setAttempt((count) => count + 1);
      } else if (apiError.code === 'CONFLICT_UNIQUE') {
        showProblems([
          {
            name: 'name',
            label: labels.name,
            message: t`Your clinic already has a branch with this name.`,
          },
        ]);
      } else {
        onFailed(apiError);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(submit)(event);
      }}
    >
      <FormErrorSummary errors={summary} focusKey={attempt} />
      <TextField
        label={labels.name}
        autoComplete="off"
        error={formState.errors.name?.message}
        {...register('name')}
      />
      <TextField
        label={labels.addressLine}
        optional
        autoComplete="off"
        error={formState.errors.addressLine?.message}
        {...register('addressLine')}
      />
      <TextField
        label={labels.city}
        optional
        autoComplete="off"
        error={formState.errors.city?.message}
        {...register('city')}
      />
      <TextField
        label={labels.province}
        optional
        autoComplete="off"
        error={formState.errors.province?.message}
        {...register('province')}
      />
      <Combobox
        label={labels.timezone}
        name="timezone"
        optional
        hint={
          clinicTimeZone
            ? t`Leave empty to use the clinic's time zone (${clinicTimeZone}).`
            : t`Leave empty to use the clinic's time zone.`
        }
        options={zoneOptions}
        value={timezone}
        onChange={setTimezone}
      />
      {nothingToChange && <p role="status">{t`Nothing to change.`}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={isSaving} loadingText={savingLabel}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t`Cancel`}
          </Button>
        )}
      </div>
    </form>
  );
}
