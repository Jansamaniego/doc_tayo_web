import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { messageForError } from '@/api/error-messages.ts';
import { isApiError, networkError, type ApiError } from '@/api/errors.ts';
import type { SessionNotice } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Checkbox } from '@/design-system/components/choice-fields.tsx';
import { ErrorState } from '@/design-system/components/state-views.tsx';
import { PasswordField, TextField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { ActionWithReason } from '@/design-system/patterns/permission.tsx';
import { AppLink } from '@/lib/app-link.tsx';
import { readPreference } from '@/lib/preferences.ts';

import { useRateLimitReason } from './rate-limit.ts';
import { useSessionController } from './session-context.tsx';

interface Values {
  email: string;
  password: string;
}

/** Why the person is here: the session ended, or they just finished a flow that ends at the sign-in page. */
export type LoginNotice =
  SessionNotice | 'password-reset' | 'account-ready' | 'invitation-accepted';

export interface LoginFormProps {
  notice?: LoginNotice | undefined;
  onSignedIn: () => void;
}

export function LoginForm({ notice, onSignedIn }: LoginFormProps) {
  const { t } = useLingui();
  const controller = useSessionController();
  const { register, handleSubmit, setValue, setFocus, formState } = useForm<Values>({
    defaultValues: { email: '', password: '' },
  });
  const [shared, setShared] = useState(() => readPreference('sharedComputer'));
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [attempt, setAttempt] = useState(0);
  const waitReason = useRateLimitReason(failure);

  const NOTICES: Record<LoginNotice, string> = {
    inactive: t`You were signed out because the computer was not used for 10 minutes.`,
    expired: t`Your session ended. Please sign in again.`,
    'signed-out-elsewhere': t`You signed out in another window.`,
    'password-changed': t`Your password was changed. For your safety, every device was signed out.`,
    'email-changed': t`Your email was changed. Sign in with your new address.`,
    'password-reset': t`Your password was saved. Sign in with your new password.`,
    'account-ready': t`Your account is ready. Sign in to start.`,
    'invitation-accepted': t`You have joined the clinic. Sign in to open it.`,
  };

  const summary: SummaryEntry[] = [];
  if (formState.errors.email?.message)
    summary.push({ name: 'email', label: t`Email`, message: formState.errors.email.message });
  if (formState.errors.password?.message)
    summary.push({
      name: 'password',
      label: t`Password`,
      message: formState.errors.password.message,
    });

  async function signIn(values: Values): Promise<void> {
    setFailure(undefined);
    try {
      await controller.signIn({ ...values, sharedComputer: shared });
      onSignedIn();
    } catch (error) {
      const apiError = isApiError(error) ? error : networkError(error);
      setFailure(apiError);
      if (apiError.code === 'INVALID_CREDENTIALS') {
        // Keep the email, clear only the password, and put the cursor there.
        setValue('password', '');
        setFocus('password');
      }
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(signIn, () => {
          setAttempt((count) => count + 1);
        })(event);
      }}
    >
      {notice && <Alert variant="info">{NOTICES[notice]}</Alert>}
      <FormErrorSummary errors={summary} focusKey={attempt} />
      {failure?.code === 'INVALID_CREDENTIALS' && (
        <Alert variant="danger">{messageForError(failure)}</Alert>
      )}
      {failure?.code === 'RATE_LIMITED' && waitReason && (
        <Alert variant="warning">{messageForError(failure)}</Alert>
      )}
      {failure && failure.code !== 'INVALID_CREDENTIALS' && failure.code !== 'RATE_LIMITED' && (
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
      <PasswordField
        label={t`Password`}
        autoComplete="current-password"
        error={formState.errors.password?.message}
        {...register('password', { required: t`Enter your password.` })}
      />
      <div className="flex flex-col gap-1">
        <Checkbox
          label={t`This is a shared computer`}
          checked={shared}
          onCheckedChange={(next) => {
            setShared(next === true);
          }}
        />
        <p className="pl-9 text-small text-ink-muted">
          {t`Choose this on a computer other people also use. You will be signed out after 10 minutes without use.`}
        </p>
      </div>

      <ActionWithReason
        type="submit"
        size="lg"
        loading={formState.isSubmitting}
        loadingText={t`Signing in…`}
        reason={waitReason}
      >
        {t`Sign in`}
      </ActionWithReason>
      <AppLink href="/forgot-password" className="self-start">
        {t`Forgot your password?`}
      </AppLink>
    </form>
  );
}
