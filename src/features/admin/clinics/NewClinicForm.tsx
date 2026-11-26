import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError, type ApiError } from '@/api/errors.ts';
import { Combobox } from '@/design-system/components/select-fields.tsx';
import { ErrorState } from '@/design-system/components/state-views.tsx';
import { TextField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { ActionWithReason } from '@/design-system/patterns/permission.tsx';
import { useRateLimitReason } from '@/features/auth/rate-limit.ts';
import { applyApiErrors } from '@/lib/api-form-errors.ts';
import { timeZoneOptions } from '@/lib/datetime/index.ts';

import { useCreateTenant } from '../api/admin-tenants.ts';
import { isValidSlug, suggestSlug } from './slug.ts';

interface Values {
  name: string;
  slug: string;
  ownerFullName: string;
  ownerEmail: string;
}

const DEFAULT_TIME_ZONE = 'Asia/Manila';

export function NewClinicForm({
  onCreated,
}: {
  onCreated: (created: { id: string; ownerEmail: string }) => void;
}) {
  const { t } = useLingui();
  const create = useCreateTenant();
  const { register, handleSubmit, setValue, setError, formState } = useForm<Values>({
    defaultValues: { name: '', slug: '', ownerFullName: '', ownerEmail: '' },
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [timezone, setTimezone] = useState(DEFAULT_TIME_ZONE);
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const waitReason = useRateLimitReason(failure);

  const labels: Record<string, string> = {
    name: t`Clinic name`,
    slug: t`Web address name`,
    ownerFullName: t`Owner's full name`,
    ownerEmail: t`Owner's email`,
    timezone: t`Time zone`,
  };

  async function submit(values: Values): Promise<void> {
    setFailure(undefined);
    setSummary([]);
    try {
      const created = await create.mutateAsync({
        name: values.name.trim(),
        slug: values.slug,
        ownerEmail: values.ownerEmail.trim(),
        ownerFullName: values.ownerFullName.trim(),
        timezone,
      });
      onCreated({ id: created.id, ownerEmail: values.ownerEmail.trim() });
    } catch (error) {
      const apiError = asApiError(error);
      if (apiError.code === 'VALIDATION_FAILED') {
        setSummary(applyApiErrors({ error: apiError, setError, fieldLabels: labels }).summary);
        setAttempt((count) => count + 1);
      } else if (apiError.code === 'CONFLICT_UNIQUE') {
        const message = t`This web address name is already used. Choose another.`;
        setError('slug', { type: 'server', message });
        setSummary([{ name: 'slug', label: labels.slug ?? '', message }]);
        setAttempt((count) => count + 1);
      } else {
        setFailure(apiError);
      }
    }
  }

  const clientErrors: SummaryEntry[] = (Object.keys(formState.errors) as (keyof Values)[]).flatMap(
    (name) => {
      const message = formState.errors[name]?.message;
      return message ? [{ name, label: labels[name] ?? name, message }] : [];
    },
  );

  return (
    <form
      noValidate
      className="flex max-w-reading flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(submit, () => {
          setAttempt((count) => count + 1);
        })(event);
      }}
    >
      <FormErrorSummary errors={summary.length > 0 ? summary : clientErrors} focusKey={attempt} />
      {failure && failure.code !== 'RATE_LIMITED' && (
        <ErrorState message={messageForError(failure)} requestId={failure.requestId} />
      )}
      <TextField
        label={t`Clinic name`}
        error={formState.errors.name?.message}
        {...register('name', {
          required: t`Enter the clinic name.`,
          maxLength: { value: 120, message: t`Use at most 120 characters.` },
          onChange: (event: { target: { value: string } }) => {
            if (!slugEdited) setValue('slug', suggestSlug(event.target.value));
          },
        })}
      />
      <TextField
        label={t`Web address name`}
        hint={t`Lower-case letters and numbers, with single hyphens between words. For example: bayview-clinic.`}
        autoCapitalize="none"
        spellCheck={false}
        error={formState.errors.slug?.message}
        {...register('slug', {
          required: t`Enter a web address name (for example bayview-clinic).`,
          validate: (value) =>
            isValidSlug(value) ||
            (value.length > 60
              ? t`Use at most 60 characters.`
              : t`Use lower-case letters and numbers, with single hyphens between words.`),
          onChange: () => {
            setSlugEdited(true);
          },
        })}
      />
      <TextField
        label={t`Owner's full name`}
        autoComplete="off"
        error={formState.errors.ownerFullName?.message}
        {...register('ownerFullName', {
          required: t`Enter the owner's full name.`,
          maxLength: { value: 120, message: t`Use at most 120 characters.` },
        })}
      />
      <TextField
        label={t`Owner's email`}
        type="email"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        hint={t`We email the owner a link to set up their account.`}
        error={formState.errors.ownerEmail?.message}
        {...register('ownerEmail', {
          required: t`Enter the owner's email address.`,
          pattern: { value: /^[^\s@]+@[^\s@]+$/, message: t`Enter a valid email address.` },
        })}
      />
      <Combobox
        label={t`Time zone`}
        name="timezone"
        options={timeZoneOptions()}
        value={timezone}
        onChange={setTimezone}
      />
      <ActionWithReason
        type="submit"
        size="lg"
        loading={formState.isSubmitting}
        loadingText={t`Creating…`}
        reason={waitReason}
      >
        {t`Create clinic`}
      </ActionWithReason>
    </form>
  );
}
