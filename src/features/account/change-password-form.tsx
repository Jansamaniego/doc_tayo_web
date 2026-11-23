import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { getApiClient } from '@/api/client.ts';
import { messageForError } from '@/api/error-messages.ts';
import { isApiError, networkError, type ApiError } from '@/api/errors.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { ErrorState } from '@/design-system/components/state-views.tsx';
import { PasswordField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { ActionWithReason } from '@/design-system/patterns/permission.tsx';
import { PASSWORD_HINT, passwordRules } from '@/features/auth/passwords.ts';
import { useRateLimitReason } from '@/features/auth/rate-limit.ts';
import { applyApiErrors } from '@/lib/api-form-errors.ts';

interface Values {
  currentPassword: string;
  newPassword: string;
}

/**
 * A signed-in person changes their own password (POST /me/password, 204). The server keeps this
 * device signed in and revokes every other session. Limited to 5 tries per 15 minutes.
 */
export function ChangePasswordForm({ email }: { email: string }) {
  const { t } = useLingui();
  const { register, handleSubmit, setError, reset, control, formState } = useForm<Values>({
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [changed, setChanged] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const waitReason = useRateLimitReason(failure);
  const password = useWatch({ control, name: 'newPassword' });

  async function change(values: Values): Promise<void> {
    setFailure(undefined);
    setSummary([]);
    setChanged(false);
    try {
      await getApiClient().POST('/api/v1/me/password', { body: values });
      reset();
      setChanged(true);
    } catch (error) {
      const apiError = isApiError(error) ? error : networkError(error);
      if (apiError.code === 'VALIDATION_FAILED') {
        setSummary(
          applyApiErrors({
            error: apiError,
            setError,
            fieldLabels: {
              currentPassword: t`Current password`,
              newPassword: t`New password`,
            },
          }).summary,
        );
        setAttempt((count) => count + 1);
      } else {
        setFailure(apiError);
      }
    }
  }

  const clientErrors: SummaryEntry[] = [];
  if (formState.errors.currentPassword?.message) {
    clientErrors.push({
      name: 'currentPassword',
      label: t`Current password`,
      message: formState.errors.currentPassword.message,
    });
  }
  if (formState.errors.newPassword?.message) {
    clientErrors.push({
      name: 'newPassword',
      label: t`New password`,
      message: formState.errors.newPassword.message,
    });
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(change, () => {
          setAttempt((count) => count + 1);
        })(event);
      }}
    >
      {changed && (
        <Alert variant="success">
          {t`Your password was changed. Your other devices were signed out; this one stays signed in.`}
        </Alert>
      )}
      <FormErrorSummary errors={summary.length > 0 ? summary : clientErrors} focusKey={attempt} />
      {failure && failure.code !== 'RATE_LIMITED' && (
        <ErrorState message={messageForError(failure)} requestId={failure.requestId} />
      )}
      <PasswordField
        label={t`Current password`}
        autoComplete="current-password"
        error={formState.errors.currentPassword?.message}
        {...register('currentPassword', { required: t`Enter your current password.` })}
      />
      <PasswordField
        label={t`New password`}
        autoComplete="new-password"
        hint={PASSWORD_HINT()}
        rules={passwordRules({ password, email })}
        error={formState.errors.newPassword?.message}
        {...register('newPassword', { required: t`Enter a new password.` })}
      />
      <div>
        <ActionWithReason
          type="submit"
          size="lg"
          loading={formState.isSubmitting}
          loadingText={t`Saving…`}
          reason={waitReason}
        >
          {t`Change password`}
        </ActionWithReason>
      </div>
    </form>
  );
}
