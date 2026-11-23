import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { getApiClient } from '@/api/client.ts';
import { messageForError } from '@/api/error-messages.ts';
import { isApiError, networkError, type ApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { ErrorState } from '@/design-system/components/state-views.tsx';
import { ActionWithReason } from '@/design-system/patterns/permission.tsx';
import { AppLink } from '@/lib/app-link.tsx';

import { useRateLimitReason } from './rate-limit.ts';

/**
 * Step two of changing the email: the person opened the link sent to the new address. The token is
 * sent only when they press the button, so a link opened twice, or by a mail scanner, does not use it
 * up. On success the server has ended every session (this one too): the page does that locally.
 */
export function VerifyEmailForm({
  token,
  onDone,
}: {
  /** From the emailed link's fragment; null when the link has none. */
  token: string | null;
  onDone: () => void;
}) {
  const { t } = useLingui();
  const session = useSession();
  const signedIn = session.status === 'signed-in';
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiError | undefined>();
  const waitReason = useRateLimitReason(failure);

  if (token === null || failure?.code === 'TOKEN_INVALID') {
    return (
      <Alert variant="danger">
        <p>{t`This link has expired, was already used, or a newer link was sent.`}</p>
        <AppLink href={signedIn ? '/account' : '/login'} standalone>
          {signedIn ? t`Go to My account` : t`Go to sign in`}
        </AppLink>
      </Alert>
    );
  }

  async function confirm(): Promise<void> {
    setFailure(undefined);
    setBusy(true);
    try {
      await getApiClient().POST('/api/v1/auth/email/verify', { body: { token: token ?? '' } });
      onDone();
    } catch (error) {
      setFailure(isApiError(error) ? error : networkError(error));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-lg">
        {t`Press the button to finish changing your email address. You will be signed out on every device and sign in again with the new address.`}
      </p>
      {failure?.code === 'CONFLICT_UNIQUE' && (
        <Alert variant="warning">
          {t`Someone else started using this address. Your email was not changed.`}
        </Alert>
      )}
      {failure && failure.code !== 'CONFLICT_UNIQUE' && failure.code !== 'RATE_LIMITED' && (
        <ErrorState message={messageForError(failure)} requestId={failure.requestId} />
      )}
      <ActionWithReason
        size="lg"
        loading={busy}
        loadingText={t`Confirming…`}
        reason={waitReason}
        onClick={() => {
          void confirm();
        }}
      >
        {t`Confirm new email address`}
      </ActionWithReason>
    </div>
  );
}
