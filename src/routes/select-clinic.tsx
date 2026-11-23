import { createFileRoute } from '@tanstack/react-router';

import { requireSignedIn } from '@/app/guards.ts';
import { SelectClinicPage } from '@/features/auth/auth-pages.tsx';

export const Route = createFileRoute('/select-clinic')({
  beforeLoad: () => {
    requireSignedIn();
  },
  component: SelectClinicPage,
});
