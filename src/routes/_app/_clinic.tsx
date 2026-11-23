import { createFileRoute, Outlet } from '@tanstack/react-router';

import { requireClinic } from '@/app/guards.ts';

export const Route = createFileRoute('/_app/_clinic')({
  beforeLoad: () => {
    requireClinic();
  },
  component: Outlet,
});
