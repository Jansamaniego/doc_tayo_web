import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { asApiError, type ApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { ConfirmDialog } from '@/design-system/components/confirm-dialog.tsx';
import { Combobox } from '@/design-system/components/select-fields.tsx';
import { TextField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { applyApiErrors } from '@/lib/api-form-errors.ts';
import { timeZoneOptions } from '@/lib/datetime/index.ts';

import {
  useUpdateClinicProfile,
  type ClinicProfile,
  type ClinicProfileChanges,
} from '../api/tenant.ts';
import { parseContactPhone } from './contact-phone.ts';

interface Values {
  name: string;
  contactEmail: string;
  contactPhone: string;
}

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/;

/**
 * Changes the clinic's name, time zone and contact details (`PATCH /tenant`). Only what changed is
 * sent; an emptied email or phone is sent as `null`. A new time zone asks first, because every date
 * on every screen moves into it. Failures that are not about a field go to the page (`onFailed`).
 */
export function ClinicProfileForm({
  clinic,
  onSaved,
  onFailed,
  onCancel,
}: {
  clinic: ClinicProfile;
  /** What was sent, so the page can tell whether the name changed. */
  onSaved: (sent: ClinicProfileChanges) => void;
  onFailed: (error: ApiError) => void;
  onCancel: () => void;
}) {
  const { t } = useLingui();
  const update = useUpdateClinicProfile();
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    defaultValues: {
      name: clinic.name,
      contactEmail: clinic.contactEmail ?? '',
      contactPhone: clinic.contactPhone ?? '',
    },
  });
  const [timezone, setTimezone] = useState(clinic.timezone);
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [nothingToChange, setNothingToChange] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [zoneChangeAwaitingConfirmation, setZoneChangeAwaitingConfirmation] = useState<
    { changes: ClinicProfileChanges; clinicName: string } | undefined
  >();

  const labels = {
    name: t`Clinic name`,
    timezone: t`Time zone`,
    contactEmail: t`Contact email`,
    contactPhone: t`Contact phone`,
  };

  async function send(changes: ClinicProfileChanges): Promise<void> {
    try {
      await update.mutateAsync(changes);
      onSaved(changes);
    } catch (error) {
      const apiError = asApiError(error);
      if (apiError.code === 'VALIDATION_FAILED') {
        setSummary(applyApiErrors({ error: apiError, setError, fieldLabels: labels }).summary);
        setAttempt((count) => count + 1);
      } else {
        onFailed(apiError);
      }
    }
  }

  async function submit(values: Values): Promise<void> {
    setNothingToChange(false);
    const name = values.name.trim();
    const email = values.contactEmail.trim();
    const phone = parseContactPhone(values.contactPhone);

    const problems: SummaryEntry[] = [];
    const reject = (field: keyof Values, message: string): void => {
      problems.push({ name: field, label: labels[field], message });
    };
    if (name === '') reject('name', t`Enter the clinic name.`);
    else if (name.length > MAX_NAME) reject('name', t`Use at most 120 characters.`);
    if (email !== '' && !EMAIL_SHAPE.test(email)) {
      reject('contactEmail', t`Enter a valid email address.`);
    } else if (email.length > MAX_EMAIL) {
      reject('contactEmail', t`Use at most 254 characters.`);
    }
    if (phone.status === 'invalid') {
      reject(
        'contactPhone',
        t`Enter the phone number with its country code, for example +639171234567.`,
      );
    }
    if (problems.length > 0) {
      for (const problem of problems) {
        setError(problem.name as keyof Values, { type: 'client', message: problem.message });
      }
      setSummary(problems);
      setAttempt((count) => count + 1);
      return;
    }
    setSummary([]);

    const newPhone = phone.status === 'valid' ? phone.phone : null;
    const changes: ClinicProfileChanges = {
      ...(name !== clinic.name && { name }),
      ...(timezone !== clinic.timezone && { timezone }),
      ...(email !== (clinic.contactEmail ?? '') && { contactEmail: email === '' ? null : email }),
      ...(newPhone !== clinic.contactPhone && { contactPhone: newPhone }),
    };
    if (Object.keys(changes).length === 0) {
      setNothingToChange(true);
      return;
    }
    if (changes.timezone !== undefined) {
      setZoneChangeAwaitingConfirmation({ changes, clinicName: name });
      return;
    }
    await send(changes);
  }

  return (
    <>
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
        <Combobox
          label={labels.timezone}
          name="timezone"
          options={timeZoneOptions()}
          value={timezone}
          onChange={setTimezone}
        />
        <TextField
          label={labels.contactEmail}
          optional
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          error={formState.errors.contactEmail?.message}
          {...register('contactEmail')}
        />
        <TextField
          label={labels.contactPhone}
          optional
          type="tel"
          inputMode="tel"
          autoComplete="off"
          hint={t`With the country code, for example +639171234567. Spaces and dashes are fine.`}
          error={formState.errors.contactPhone?.message}
          {...register('contactPhone')}
        />
        {nothingToChange && <p role="status">{t`Nothing to change.`}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={update.isPending} loadingText={t`Saving…`}>
            {t`Save`}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t`Cancel`}
          </Button>
        </div>
      </form>

      {zoneChangeAwaitingConfirmation && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setZoneChangeAwaitingConfirmation(undefined);
          }}
          title={t`Change the time zone?`}
          description={t`Dates and times for ${zoneChangeAwaitingConfirmation.clinicName} will show in ${timezone}. Saved times do not move; they are shown in the new zone. Branches with their own time zone keep it.`}
          confirmLabel={t`Change time zone`}
          destructive={false}
          onConfirm={() => {
            void send(zoneChangeAwaitingConfirmation.changes);
          }}
        />
      )}
    </>
  );
}
