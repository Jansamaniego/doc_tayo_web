import { useLingui } from '@lingui/react/macro';
import { Building2 } from 'lucide-react';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { isApiError, networkError, type ApiError } from '@/api/errors.ts';
import { isUsableMembership, type Membership } from '@/api/session/session-store.ts';
import { StatusPill } from '@/design-system/components/badge.tsx';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { AppLink } from '@/lib/app-link.tsx';

export interface SelectClinicProps {
  memberships: Membership[];
  /** Switches to the clinic. Throws an ApiError if it cannot be opened. */
  onSelect: (tenantId: string) => Promise<void>;
  onSignOut: () => void;
  /** The clinic an admin just took away from this person, when the app sent them here for that. */
  lostClinicName?: string;
  /** A platform admin can go to the Clinics tab instead (it needs no clinic). */
  showAdminLink?: boolean;
}

export function SelectClinic({
  memberships,
  onSelect,
  onSignOut,
  lostClinicName,
  showAdminLink = false,
}: SelectClinicProps) {
  const { t } = useLingui();
  const [pending, setPending] = useState<string | undefined>();
  const [failure, setFailure] = useState<ApiError | undefined>();
  const usable = memberships.filter(isUsableMembership);
  const unavailable = memberships.filter((membership) => !isUsableMembership(membership));

  async function choose(tenantId: string): Promise<void> {
    setPending(tenantId);
    setFailure(undefined);
    try {
      await onSelect(tenantId);
    } catch (error) {
      setFailure(isApiError(error) ? error : networkError(error));
      setPending(undefined);
    }
  }

  function reasonFor(membership: Membership): string {
    if (membership.tenantStatus === 'suspended') return t`Suspended`;
    if (membership.tenantStatus === 'deactivated') return t`No longer active`;
    if (membership.membershipStatus === 'removed') return t`You no longer have access`;
    if (membership.membershipStatus === 'suspended') return t`Your access is paused`;
    return t`Invitation not accepted yet`;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1>{t`Choose a clinic`}</h1>
      {lostClinicName !== undefined && (
        <Alert variant="warning">{t`You no longer have access to ${lostClinicName}.`}</Alert>
      )}
      {failure && <Alert variant="danger">{messageForError(failure)}</Alert>}

      {usable.length > 0 ? (
        <ul aria-label={t`Your clinics`} className="flex flex-col gap-3">
          {usable.map((membership) => (
            <li key={membership.tenantId}>
              <Button
                variant="secondary"
                size="lg"
                icon={<Building2 className="size-6" />}
                className="w-full justify-start text-left"
                loading={pending === membership.tenantId}
                loadingText={t`Opening ${membership.tenantName}…`}
                unavailable={pending !== undefined && pending !== membership.tenantId}
                onClick={() => void choose(membership.tenantId)}
              >
                <span className="flex flex-col items-start">
                  <span>{membership.tenantName}</span>
                  <span className="text-small font-normal">
                    {membership.roles.map((role) => role.name).join(', ')}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-body-lg">{t`You don't have a clinic you can open right now.`}</p>
          <p>{t`Ask your clinic admin, or sign out and try another account.`}</p>
          <div>
            <Button variant="secondary" onClick={onSignOut}>
              {t`Sign out`}
            </Button>
          </div>
        </div>
      )}

      {showAdminLink && (
        <AppLink href="/admin" standalone className="self-start">
          {t`Go to the platform overview`}
        </AppLink>
      )}

      {unavailable.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-h3">{t`Not available`}</h2>
          <ul aria-label={t`Not available`} className="flex flex-col gap-2">
            {unavailable.map((membership) => (
              <li
                key={membership.tenantId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-divider bg-subtle px-4 py-3"
              >
                <span className="font-semibold">{membership.tenantName}</span>
                <StatusPill status="neutral">{reasonFor(membership)}</StatusPill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
