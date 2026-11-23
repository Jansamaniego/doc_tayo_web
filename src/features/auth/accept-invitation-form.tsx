import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { getApiClient } from '@/api/client.ts';
import { messageForError } from '@/api/error-messages.ts';
import { isApiError, networkError, type ApiError } from '@/api/errors.ts';
import { Alert } from '@/design-system/components/alert.tsx';
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
import { InvalidLinkAlert } from './token-form-parts.tsx';

interface Values {
  fullName: string;
  newPassword: string;
}

/**
 * The page cannot know whether the invited email already has an account. It sends the token alone
 * first; if the server answers that a name and password are REQUIRED, those two fields appear and the
 * next send includes them (docs/frontend-integration.md §7).
 */
export function AcceptInvitationForm({
  token,
  onDone,
}: {
  token: string | null;
  onDone: () => void;
}) {
  const { t } = useLingui();
  const { register, handleSubmit, setError, control, formState } = useForm<Values>({
    defaultValues: { fullName: '', newPassword: '' },
  });
  const [needsAccount, setNeedsAccount] = useState(false);
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const waitReason = useRateLimitReason(failure);
  const password = useWatch({ control, name: 'newPassword' });

  if (token === null || failure?.code === 'TOKEN_INVALID') {
    return (
      <InvalidLinkAlert>
        <p>{t`Ask your clinic admin to send you a new invitation.`}</p>
      </InvalidLinkAlert>
    );
  }

  async function accept(values: Values): Promise<void> {
    setFailure(undefined);
    setSummary([]);
    try {
      await getApiClient().POST('/api/v1/invitations/accept', {
        body: {
          token: token ?? '',
          ...(needsAccount && {
            fullName: values.fullName.trim(),
            newPassword: values.newPassword,
          }),
        },
      });
      onDone();
    } catch (error) {
      const apiError = isApiError(error) ? error : networkError(error);
      const asksForAccount =
        apiError.code === 'VALIDATION_FAILED' &&
        apiError.details.some(
          (detail) =>
            (detail.field === 'fullName' || detail.field === 'newPassword') &&
            detail.code === 'REQUIRED',
        );
      if (asksForAccount && !needsAccount) {
        // Only a question: show the two fields, without "please fill in" errors.
        setNeedsAccount(true);
      } else if (apiError.code === 'VALIDATION_FAILED') {
        setSummary(
          applyApiErrors({
            error: apiError,
            setError,
            fieldLabels: { fullName: t`Your name`, newPassword: t`New password` },
          }).summary,
        );
        setAttempt((count) => count + 1);
      } else {
        setFailure(apiError);
      }
    }
  }

  const clientErrors: SummaryEntry[] = [];
  if (formState.errors.fullName?.message)
    clientErrors.push({
      name: 'fullName',
      label: t`Your name`,
      message: formState.errors.fullName.message,
    });
  if (formState.errors.newPassword?.message)
    clientErrors.push({
      name: 'newPassword',
      label: t`New password`,
      message: formState.errors.newPassword.message,
    });

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(accept, () => {
          setAttempt((count) => count + 1);
        })(event);
      }}
    >
      <p>{t`You have been invited to join a clinic on DocTayo.`}</p>
      <FormErrorSummary errors={summary.length > 0 ? summary : clientErrors} focusKey={attempt} />
      {failure && <ErrorState message={messageForError(failure)} requestId={failure.requestId} />}
      {needsAccount && (
        <>
          <Alert variant="info">{t`Create your account to finish joining the clinic.`}</Alert>
          <TextField
            label={t`Your name`}
            autoComplete="name"
            error={formState.errors.fullName?.message}
            {...register('fullName', { required: t`Enter your name.` })}
          />
          <PasswordField
            label={t`New password`}
            autoComplete="new-password"
            hint={PASSWORD_HINT()}
            rules={passwordRules({ password })}
            error={formState.errors.newPassword?.message}
            {...register('newPassword', { required: t`Enter a new password.` })}
          />
        </>
      )}
      <ActionWithReason
        type="submit"
        size="lg"
        loading={formState.isSubmitting}
        loadingText={t`Saving…`}
        reason={waitReason}
      >
        {needsAccount ? t`Create account and accept` : t`Accept invitation`}
      </ActionWithReason>
    </form>
  );
}
