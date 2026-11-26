import { createFileRoute } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';
import { ServicePage } from '@/features/services/record/ServicePage.tsx';

export const Route = createFileRoute('/_app/_clinic/clinic/services/$serviceId')({
  component: function Service() {
    const { serviceId } = Route.useParams();
    return (
      <RequirePermission permission="services.read">
        <ServicePage key={serviceId} serviceId={serviceId} />
      </RequirePermission>
    );
  },
});
