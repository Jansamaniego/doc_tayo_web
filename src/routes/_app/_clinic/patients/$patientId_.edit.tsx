import { createFileRoute } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';
import { EditPatientPage } from '@/features/patients/form/EditPatientPage.tsx';

export const Route = createFileRoute('/_app/_clinic/patients/$patientId_/edit')({
  component: function EditPatient() {
    const { patientId } = Route.useParams();
    const navigate = Route.useNavigate();
    return (
      <RequirePermission permission="patients.manage">
        <EditPatientPage
          key={patientId}
          patientId={patientId}
          onSaved={() => {
            void navigate({ to: '/patients/$patientId', params: { patientId } });
          }}
        />
      </RequirePermission>
    );
  },
});
