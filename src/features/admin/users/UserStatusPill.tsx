import { useLingui } from '@lingui/react/macro';

import { StatusPill, type Status } from '@/design-system/components/badge.tsx';

import type { UserStatus } from '../api/admin-users.ts';

const PILL: Record<UserStatus, Status> = {
  pending: 'info',
  active: 'success',
  deactivated: 'neutral',
};

/** The status in words (the colour is a second cue, never the only one). */
export function UserStatusPill({ status }: { status: UserStatus }) {
  const { t } = useLingui();
  const label: Record<UserStatus, string> = {
    pending: t`Pending`,
    active: t`Active`,
    deactivated: t`Deactivated`,
  };
  return <StatusPill status={PILL[status]}>{label[status]}</StatusPill>;
}
