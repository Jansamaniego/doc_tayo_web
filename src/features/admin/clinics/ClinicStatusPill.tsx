import { useLingui } from '@lingui/react/macro';

import { StatusPill, type Status } from '@/design-system/components/badge.tsx';

import type { TenantStatus } from '../api/admin-tenants.ts';

const PILL: Record<TenantStatus, Status> = {
  active: 'success',
  suspended: 'warning',
  deactivated: 'neutral',
};

/** The status in words (the colour is a second cue, never the only one). */
export function ClinicStatusPill({ status }: { status: TenantStatus }) {
  const { t } = useLingui();
  const label: Record<TenantStatus, string> = {
    active: t`Active`,
    suspended: t`Suspended`,
    deactivated: t`Deactivated`,
  };
  return <StatusPill status={PILL[status]}>{label[status]}</StatusPill>;
}
