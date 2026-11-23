import { createFileRoute } from '@tanstack/react-router';

import { NewClinicPage } from '@/features/admin/clinics/NewClinicPage.tsx';

export const Route = createFileRoute('/_app/admin/clinics/new')({
  component: function NewClinic() {
    const navigate = Route.useNavigate();
    return (
      <NewClinicPage
        onCreated={(tenantId) => {
          void navigate({ to: '/admin/clinics/$tenantId', params: { tenantId } });
        }}
      />
    );
  },
});
