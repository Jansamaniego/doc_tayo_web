import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { getApiClient } from '@/api/client.ts';
import { messageForError } from '@/api/error-messages.ts';
import { isApiError, networkError, type ApiError } from '@/api/errors.ts';
import { ErrorState } from '@/design-system/components/state-views.tsx';
import { PasswordField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { ActionWithReason } from '@/design-system/patterns/permission.tsx';
import { applyApiErrors } from '@/lib/api-form-errors.ts';

import { PASSWORD_HINT, passwordRules } from './passwords.ts';
import { useRateLimitReason } from './rate-limit.ts';
import { InvalidLinkAlert, NewLinkLink } from './token-form-parts.tsx';

export interface ResetPasswordFormProps {
  /** From the emailed link's fragment; null when the link has none. */
  token: string | null;
  onDone: () => void;
}

export function ResetPasswordForm({ token, onDone }: ResetPasswordFormProps) {
  const { t } = useLingui();
  const { register, handleSubmit, setError, control, formState } = useForm<{ newPassword: string }>(
    {
      defaultValues: { newPassword: '' },
    },
  );
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

  async function save({ newPassword }: { newPassword: string }): Promise<void> {
    setFailure(undefined);
    setSummary([]);
    try {
      await getApiClient().POST('/api/v1/auth/password/reset', {
        body: { token: token ?? '', newPassword },
      });
      onDone();
    } catch (error) {
      const apiError = isApiError(error) ? error : networkError(error);
      if (apiError.code === 'VALIDATION_FAILED') {
        setSummary(
          applyApiErrors({
            error: apiError,
            setError,
            fieldLabels: { newPassword: t`New password` },
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
        void handleSubmit(save, () => {
          setAttempt((count) => count + 1);
        })(event);
      }}
    >
      <FormErrorSummary errors={summary.length > 0 ? summary : clientErrors} focusKey={attempt} />
      {failure && <ErrorState message={messageForError(failure)} requestId={failure.requestId} />}
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
        {t`Save new password`}
      </ActionWithReason>
    </form>
  );
}
