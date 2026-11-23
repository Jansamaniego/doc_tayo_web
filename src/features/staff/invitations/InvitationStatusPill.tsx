import { useLingui } from '@lingui/react/macro';

import { StatusPill, type Status } from '@/design-system/components/badge.tsx';

import type { InvitationStatus } from '../api/invitations.ts';

const PILL: Record<InvitationStatus, Status> = {
  pending: 'info',
  accepted: 'success',
  revoked: 'neutral',
  expired: 'warning',
};

/** The status in words (the colour is a second cue, never the only one). */
export function InvitationStatusPill({ status }: { status: InvitationStatus }) {
  const { t } = useLingui();
  const label: Record<InvitationStatus, string> = {
    pending: t`Pending`,
    accepted: t`Accepted`,
    revoked: t`Revoked`,
    expired: t`Expired`,
  };
  return <StatusPill status={PILL[status]}>{label[status]}</StatusPill>;
}
