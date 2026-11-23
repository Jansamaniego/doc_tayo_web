import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { Alert } from '@/design-system/components/alert.tsx';
import { AppLink } from '@/lib/app-link.tsx';

/** A link from an email that is missing, used or expired. Never says which: the server does not either. */
export function InvalidLinkAlert({ children }: { children?: ReactNode }) {
  const { t } = useLingui();
  return (
    <Alert variant="danger">
      <p>{t`This link is not valid or has expired. Please ask for a new one.`}</p>
      {children}
    </Alert>
  );
}

export function NewLinkLink() {
  const { t } = useLingui();
  return (
    <AppLink href="/forgot-password" standalone>
      {t`Send a new link`}
    </AppLink>
  );
}
