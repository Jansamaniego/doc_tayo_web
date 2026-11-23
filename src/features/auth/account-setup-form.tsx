import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { getApiClient } from '@/api/client.ts';
import { messageForError } from '@/api/error-messages.ts';
import { isApiError, networkError, type ApiError } from '@/api/errors.ts';
import { ErrorState } from '@/design-system/components/state-views.tsx';
import { PasswordField, TextField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { ActionWithReason } from '@/design-system/patterns/permission.tsx';
import { applyApiErrors } from '@/lib/api-form-errors.ts';

import { PASSWORD_HINT, passwordRules } from './passwords.ts';
import { useRateLimitReason } from './rate-limit.ts';
import { InvalidLinkAlert, NewLinkLink } from './token-form-parts.tsx';

interface Values {
  newPassword: string;
  fullName: string;
}

/** A new clinic owner chooses a password (and may correct their name) from the emailed setup link. */
export function AccountSetupForm({ token, onDone }: { token: string | null; onDone: () => void }) {
  const { t } = useLingui();
  const { register, handleSubmit, setError, control, formState } = useForm<Values>({
    defaultValues: { newPassword: '', fullName: '' },
  });
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const waitReason = useRateLimitReason(failure);
  const password = useWatch({ control, name: 'newPassword' });

  if (token === null || failure?.code === 'TOKEN_INVALID') {
    return (
      <InvalidLinkAlert>
        <NewLinkLink />
      </InvalidLinkAlert>
    );
  }

  async function setUp({ newPassword, fullName }: Values): Promise<void> {
    setFailure(undefined);
    setSummary([]);
    const name = fullName.trim();
    try {
      await getApiClient().POST('/api/v1/auth/account/setup', {
        body: { token: token ?? '', newPassword, ...(name && { fullName: name }) },
      });
      onDone();
    } catch (error) {
      const apiError = isApiError(error) ? error : networkError(error);
      if (apiError.code === 'VALIDATION_FAILED') {
        setSummary(
          applyApiErrors({
            error: apiError,
            setError,
            fieldLabels: { newPassword: t`New password`, fullName: t`Your name` },
          }).summary,
        );
        setAttempt((count) => count + 1);
      } else {
        setFailure(apiError);
      }
    }
  }

  const clientErrors: SummaryEntry[] = formState.errors.newPassword?.message
    ? [
        {
          name: 'newPassword',
          label: t`New password`,
          message: formState.errors.newPassword.message,
        },
      ]
    : [];

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(setUp, () => {
          setAttempt((count) => count + 1);
        })(event);
      }}
    >
      <FormErrorSummary errors={summary.length > 0 ? summary : clientErrors} focusKey={attempt} />
      {failure && <ErrorState message={messageForError(failure)} requestId={failure.requestId} />}
      <TextField
        label={t`Your name`}
        optional
        autoComplete="name"
        error={formState.errors.fullName?.message}
        {...register('fullName')}
      />
      <PasswordField
        label={t`New password`}
        autoComplete="new-password"
        hint={PASSWORD_HINT()}
        rules={passwordRules({ password })}
        error={formState.errors.newPassword?.message}
        {...register('newPassword', { required: t`Enter a new password.` })}
      />
      <ActionWithReason
        type="submit"
        size="lg"
        loading={formState.isSubmitting}
        loadingText={t`Saving…`}
        reason={waitReason}
      >
        {t`Set up my account`}
      </ActionWithReason>
    </form>
  );
}
