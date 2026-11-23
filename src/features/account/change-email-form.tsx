import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { getApiClient } from '@/api/client.ts';
import { messageForError } from '@/api/error-messages.ts';
import { isApiError, networkError, type ApiError } from '@/api/errors.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { ErrorState } from '@/design-system/components/state-views.tsx';
import { PasswordField, TextField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { ActionWithReason } from '@/design-system/patterns/permission.tsx';
import { useRateLimitReason } from '@/features/auth/rate-limit.ts';
import { applyApiErrors } from '@/lib/api-form-errors.ts';

interface Values {
  newEmail: string;
  currentPassword: string;
}

/**
 * Step one of changing the email (`POST /me/email`). The answer is 202 whether or not the address is
 * free (the API never says which addresses are taken), so the message is the same for every address.
 * The email does not change until the link sent to the new address is opened (`/verify-email`).
 */
export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const { t } = useLingui();
  const { register, handleSubmit, setError, setValue, reset, formState } = useForm<Values>({
    defaultValues: { newEmail: '', currentPassword: '' },
  });
  const [sentTo, setSentTo] = useState<string | undefined>();
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const waitReason = useRateLimitReason(failure);
  const labels = { newEmail: t`New email`, currentPassword: t`Your password` };

  async function send(values: Values): Promise<void> {
    setFailure(undefined);
    setSummary([]);
    const newEmail = values.newEmail.trim();
    try {
      await getApiClient().POST('/api/v1/me/email', {
        body: { newEmail, currentPassword: values.currentPassword },
      });
      setSentTo(newEmail);
    } catch (error) {
      const apiError = isApiError(error) ? error : networkError(error);
      if (apiError.code === 'VALIDATION_FAILED') {
        setSummary(applyApiErrors({ error: apiError, setError, fieldLabels: labels }).summary);
        setAttempt((count) => count + 1);
        // A wrong password is typed again, never kept in the field.
        setValue('currentPassword', '');
      } else {
        setFailure(apiError);
      }
    }
  }

  if (sentTo !== undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">
          {t`If ${sentTo} can be used, we sent a link to it. Open it within 30 minutes. Your email does not change until you do.`}
        </Alert>
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              setSentTo(undefined);
            }}
          >
            {t`Use a different address`}
          </Button>
        </div>
      </div>
    );
  }

  const clientErrors: SummaryEntry[] = [];
  if (formState.errors.newEmail?.message) {
    clientErrors.push({
      name: 'newEmail',
      label: labels.newEmail,
      message: formState.errors.newEmail.message,
    });
  }
  if (formState.errors.currentPassword?.message) {
    clientErrors.push({
      name: 'currentPassword',
      label: labels.currentPassword,
      message: formState.errors.currentPassword.message,
    });
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(send, () => {
          setAttempt((count) => count + 1);
        })(event);
      }}
    >
      <FormErrorSummary errors={summary.length > 0 ? summary : clientErrors} focusKey={attempt} />
      {failure && failure.code !== 'RATE_LIMITED' && (
        <ErrorState message={messageForError(failure)} requestId={failure.requestId} />
      )}
      <TextField
        label={labels.newEmail}
        type="email"
        inputMode="email"
        autoComplete="off"
        hint={t`We send a link to this address. Your email changes when you open it.`}
        error={formState.errors.newEmail?.message}
        {...register('newEmail', {
          validate: (value) => {
            const address = value.trim();
            if (address === '') return t`Enter the new email address.`;
            if (!/^[^\s@]+@[^\s@]+$/.test(address)) return t`Enter a valid email address.`;
            if (address.toLowerCase() === currentEmail.toLowerCase()) {
              return t`That is already your email address.`;
            }
            return true;
          },
        })}
      />
      <PasswordField
        label={labels.currentPassword}
        autoComplete="current-password"
        hint={t`We ask for it to be sure it is you.`}
        error={formState.errors.currentPassword?.message}
        {...register('currentPassword', { required: t`Enter your password.` })}
      />
      <div>
        <ActionWithReason
          type="submit"
          loading={formState.isSubmitting}
          loadingText={t`Sending…`}
          reason={waitReason}
        >
          {t`Send confirmation link`}
        </ActionWithReason>
      </div>
    </form>
  );
}
