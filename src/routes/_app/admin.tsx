import { createFileRoute, Outlet } from '@tanstack/react-router';

import { requirePlatformAdmin } from '@/app/guards.ts';

export const Route = createFileRoute('/_app/admin')({
  beforeLoad: () => {
    requirePlatformAdmin();
  },
  component: Outlet,
});
