import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { getApiClient } from '@/api/client.ts';
import { messageForError } from '@/api/error-messages.ts';
import { isApiError, networkError, type ApiError } from '@/api/errors.ts';
import { updateSignedInUser } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { ErrorState } from '@/design-system/components/state-views.tsx';
import { TextField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { applyApiErrors } from '@/lib/api-form-errors.ts';

const MAX_NAME = 120;

/** The person renames themselves (`PATCH /me`). The session takes the new name at once. */
export function ProfileNameForm({ fullName }: { fullName: string }) {
  const { t } = useLingui();
  const { register, handleSubmit, setError, reset, formState } = useForm<{ fullName: string }>({
    defaultValues: { fullName },
  });
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const [nothingToChange, setNothingToChange] = useState(false);
  const [attempt, setAttempt] = useState(0);

  async function save(values: { fullName: string }): Promise<void> {
    setFailure(undefined);
    setSummary([]);
    setSaved(false);
    setNothingToChange(false);
    const name = values.fullName.trim();
    if (name === fullName) {
      setNothingToChange(true);
      return;
    }
    try {
      const result = await getApiClient().PATCH('/api/v1/me', { body: { fullName: name } });
      if (!result.data) throw networkError(new Error('Empty answer.'));
      updateSignedInUser({ fullName: result.data.data.fullName });
      reset({ fullName: result.data.data.fullName });
      setSaved(true);
    } catch (error) {
      const apiError = isApiError(error) ? error : networkError(error);
      if (apiError.code === 'VALIDATION_FAILED') {
        setSummary(
          applyApiErrors({ error: apiError, setError, fieldLabels: { fullName: t`Name` } }).summary,
        );
        setAttempt((count) => count + 1);
      } else {
        setFailure(apiError);
      }
    }
  }

  const clientErrors: SummaryEntry[] = formState.errors.fullName?.message
    ? [{ name: 'fullName', label: t`Name`, message: formState.errors.fullName.message }]
    : [];

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(save, () => {
          setAttempt((count) => count + 1);
        })(event);
      }}
    >
      {saved && <Alert variant="success">{t`Your name was saved.`}</Alert>}
      <FormErrorSummary errors={summary.length > 0 ? summary : clientErrors} focusKey={attempt} />
      {failure && <ErrorState message={messageForError(failure)} requestId={failure.requestId} />}
      <TextField
        label={t`Name`}
        autoComplete="name"
        error={formState.errors.fullName?.message}
        {...register('fullName', {
          validate: (value) => {
            const name = value.trim();
            if (name === '') return t`Enter your name.`;
            if (name.length > MAX_NAME) return t`A name can have at most 120 characters.`;
            return true;
          },
        })}
      />
      {nothingToChange && <p role="status">{t`Nothing to change.`}</p>}
      <div>
        <Button type="submit" loading={formState.isSubmitting} loadingText={t`Saving…`}>
          {t`Save name`}
        </Button>
      </div>
    </form>
  );
}
