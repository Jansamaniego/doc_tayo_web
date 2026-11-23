import { useLingui } from '@lingui/react/macro';

import { StatusPill, type Status } from '@/design-system/components/badge.tsx';

import type { Member } from '../api/members.ts';

const PILL: Record<Member['status'], Status> = {
  active: 'success',
  suspended: 'warning',
  removed: 'neutral',
  invited: 'info',
};

/** The status in words (the colour is a second cue, never the only one). */
export function MemberStatusPill({ status }: { status: Member['status'] }) {
  const { t } = useLingui();
  const label: Record<Member['status'], string> = {
    active: t`Active`,
    suspended: t`Suspended`,
    removed: t`Removed`,
    invited: t`Invited`,
  };
  return <StatusPill status={PILL[status]}>{label[status]}</StatusPill>;
}
