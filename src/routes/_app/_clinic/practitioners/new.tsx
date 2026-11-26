import { createFileRoute } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';
import { NewPractitionerPage } from '@/features/practitioners/form/NewPractitionerPage.tsx';

export const Route = createFileRoute('/_app/_clinic/practitioners/new')({
  component: function NewPractitioner() {
    const navigate = Route.useNavigate();
    return (
      <RequirePermission permission="practitioners.manage">
        <NewPractitionerPage
          onCreated={(practitioner) => {
            void navigate({
              to: '/practitioners/$profileId',
              params: { profileId: practitioner.id },
            });
          }}
        />
      </RequirePermission>
    );
  },
});
