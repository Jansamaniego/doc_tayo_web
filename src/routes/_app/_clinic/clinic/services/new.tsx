import { createFileRoute } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';
import { NewServicePage } from '@/features/services/form/NewServicePage.tsx';

export const Route = createFileRoute('/_app/_clinic/clinic/services/new')({
  component: function NewService() {
    const navigate = Route.useNavigate();
    return (
      <RequirePermission permission="services.manage">
        <NewServicePage
          onCreated={(service) => {
            void navigate({
              to: '/clinic/services/$serviceId',
              params: { serviceId: service.id },
            });
          }}
        />
      </RequirePermission>
    );
  },
});
