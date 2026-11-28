import { useLingui } from '@lingui/react/macro';

import { StatusPill, type Status } from '@/design-system/components/badge.tsx';

import type { Appointment } from './api/appointments.ts';

const STYLES: Record<Appointment['status'], Status> = {
  scheduled: 'info',
  checked_in: 'success',
  completed: 'neutral',
  cancelled: 'danger',
  no_show: 'warning',
};

export function StatusLabel({ status }: { status: Appointment['status'] }) {
  const { t } = useLingui();
  const words: Record<Appointment['status'], string> = {
    scheduled: t`Scheduled`,
    checked_in: t`Checked in`,
    completed: t`Completed`,
    cancelled: t`Cancelled`,
    no_show: t`No-show`,
  };
  return <StatusPill status={STYLES[status]}>{words[status]}</StatusPill>;
}
