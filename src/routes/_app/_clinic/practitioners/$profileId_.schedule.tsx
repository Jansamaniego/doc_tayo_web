import { createFileRoute } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';
import { ScheduleEditorPage } from '@/features/practitioners/schedule/ScheduleEditorPage.tsx';

export const Route = createFileRoute('/_app/_clinic/practitioners/$profileId_/schedule')({
  component: function EditSchedule() {
    const { profileId } = Route.useParams();
    const navigate = Route.useNavigate();
    return (
      <RequirePermission permission="practitioners.manage">
        <ScheduleEditorPage
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
