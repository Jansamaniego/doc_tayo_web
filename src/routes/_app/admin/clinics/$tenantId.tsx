import { createFileRoute } from '@tanstack/react-router';

import { ClinicDetailPage } from '@/features/admin/clinics/ClinicDetailPage.tsx';

export const Route = createFileRoute('/_app/admin/clinics/$tenantId')({
  component: function Clinic() {
    const { tenantId } = Route.useParams();
    const navigate = Route.useNavigate();
    return (
      <ClinicDetailPage
        tenantId={tenantId}
        onMissing={() => {
          void navigate({ to: '/admin/clinics' });
        }}
      />
    );
  },
});
