import { createFileRoute } from '@tanstack/react-router';

import { ClinicProfilePage } from '@/features/clinic/profile/ClinicProfilePage.tsx';

export const Route = createFileRoute('/_app/_clinic/clinic/')({
  component: ClinicProfilePage,
});
