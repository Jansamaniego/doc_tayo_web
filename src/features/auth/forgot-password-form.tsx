import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { getApiClient } from '@/api/client.ts';
import { messageForError } from '@/api/error-messages.ts';
import { isApiError, networkError, type ApiError } from '@/api/errors.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { ErrorState } from '@/design-system/components/state-views.tsx';
import { TextField } from '@/design-system/components/text-fields.tsx';
import { ActionWithReason } from '@/design-system/patterns/permission.tsx';
import { AppLink } from '@/lib/app-link.tsx';

import { useRateLimitReason } from './rate-limit.ts';

export function ForgotPasswordForm() {
  const { t } = useLingui();
  const { register, handleSubmit, formState } = useForm<{ email: string }>({
    defaultValues: { email: '' },
  });
  const [sentTo, setSentTo] = useState<string | undefined>();
  const [failure, setFailure] = useState<ApiError | undefined>();
  const waitReason = useRateLimitReason(failure);

  async function send({ email }: { email: string }): Promise<void> {
    setFailure(undefined);
    try {
      // Always 202, whether or not the email has an account: the answer below never says which.
      await getApiClient().POST('/api/v1/auth/password/forgot', { body: { email } });
      setSentTo(email);
    } catch (error) {
      setFailure(isApiError(error) ? error : networkError(error));
    }
  }

  if (sentTo !== undefined) {
    return (
      <div className="flex flex-col gap-6">
        <Alert variant="success">
          {t`If there is an account for ${sentTo}, we have sent a link to reset the password. The link works for 30 minutes.`}
        </Alert>
        <p>{t`Check your email, including the spam folder.`}</p>
        <AppLink href="/login" standalone className="self-start">
          {t`Back to sign in`}
        </AppLink>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(send)(event);
      }}
    >
      <p>{t`Enter your email address and we will send you a link to choose a new password.`}</p>
      {failure && failure.code !== 'RATE_LIMITED' && (
        <ErrorState message={messageForError(failure)} requestId={failure.requestId} />
      )}
      <TextField
        label={t`Email`}
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        error={formState.errors.email?.message}
        {...register('email', { required: t`Enter your email address.` })}
      />
      <ActionWithReason
        type="submit"
        size="lg"
        loading={formState.isSubmitting}
        loadingText={t`Sending…`}
        reason={waitReason}
      >
        {t`Send me a link`}
      </ActionWithReason>
      <AppLink href="/login" className="self-start">
        {t`Back to sign in`}
      </AppLink>
    </form>
  );
}
