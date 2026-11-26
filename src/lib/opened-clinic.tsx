import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import type { ApiError } from '@/api/errors.ts';
import { activeMembership, sessionStore, useSession } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { ErrorState } from '@/design-system/components/state-views.tsx';

export interface OpenedClinic {
  tenantId: string;
  name: string;
}

/**
 * The clinic that is open when the form is: what is typed here is meant for it, and only it (P6-4).
 * It does not change when another clinic is chosen, here or in another tab.
 */
export function useOpenedClinic(): OpenedClinic {
  const [clinic] = useState(() => {
    const session = sessionStore.get();
    return {
      // The clinic guard lets nobody onto a form without a clinic.
      tenantId: session.status === 'signed-in' ? (session.activeTenantId ?? '') : '',
      name: activeMembership(session)?.tenantName ?? '',
    };
  });
  return clinic;
}

/** Why a save failed. A switched clinic is named, with the one the form was opened in. */
export function SaveFailure({ error, openedIn }: { error: ApiError; openedIn: OpenedClinic }) {
  const { t } = useLingui();
  const current = activeMembership(useSession());
  if (error.code === 'TENANT_MISMATCH' && current && current.tenantId !== openedIn.tenantId) {
    const opened = openedIn.name;
    const now = current.tenantName;
    return (
      <Alert variant="warning">
        {t`This page was opened for ${opened}. You are now working in ${now}. Nothing was saved.`}
      </Alert>
    );
  }
  return <ErrorState message={messageForError(error)} requestId={error.requestId} />;
}
