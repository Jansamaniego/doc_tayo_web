import { createFileRoute } from '@tanstack/react-router';

import { requireClinic } from '@/app/guards.ts';
import { AuthenticatedShell } from '@/features/shell/AuthenticatedShell.tsx';

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ location }) => {
    requireClinic(location);
  },
  component: AuthenticatedShell,
});
