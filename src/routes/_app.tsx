import { createFileRoute } from '@tanstack/react-router';

import { requireSignedIn } from '@/app/guards.ts';
import { AuthenticatedShell } from '@/features/shell/AuthenticatedShell.tsx';

// Everything signed-in people see sits in the shell. Which pages need a clinic is decided below it
// (`_clinic`); `/account` needs none, and `/admin/*` needs the platform role.
export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    requireSignedIn();
  },
  component: AuthenticatedShell,
});
