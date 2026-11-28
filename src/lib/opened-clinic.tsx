import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import type { ApiError } from '@/api/errors.ts';
import {
  activeMembership,
  sessionStore,
  useActiveTenantId,
  useSession,
} from '@/api/session/session-store.ts';
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

/**
 * What a form shows of its clinic's data: the latest read while that clinic was the open one. A clinic
 * switched in another tab reloads the queries for the other clinic, which must neither empty the form
 * nor mix in. Pass a `key` when what is read depends on a choice in the form.
 */
export function useKeptForClinic<Data>({
  data,
  tenantId,
  key = '',
}: {
  data: Data | undefined;
  tenantId: string;
  key?: string;
}): Data | undefined {
  const isOpen = useActiveTenantId() === tenantId;
  const [kept, setKept] = useState<{ key: string; data: Data }>();
  if (isOpen && data !== undefined && (kept?.data !== data || kept.key !== key)) {
    setKept({ key, data });
  }
  if (isOpen) return data;
  return kept?.key === key ? kept.data : undefined;
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
