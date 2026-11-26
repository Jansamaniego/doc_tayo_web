import { createFileRoute } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';
import { EditPractitionerPage } from '@/features/practitioners/form/EditPractitionerPage.tsx';

export const Route = createFileRoute('/_app/_clinic/practitioners/$profileId_/edit')({
  component: function EditPractitioner() {
    const { profileId } = Route.useParams();
    const navigate = Route.useNavigate();
    return (
      <RequirePermission permission="practitioners.manage">
        <EditPractitionerPage
          key={profileId}
          profileId={profileId}
          onSaved={() => {
            void navigate({ to: '/practitioners/$profileId', params: { profileId } });
          }}
        />
      </RequirePermission>
    );
  },
});
