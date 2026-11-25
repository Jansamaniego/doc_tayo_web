import { createFileRoute } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';
import { RegisterPatientPage } from '@/features/patients/form/RegisterPatientPage.tsx';

export const Route = createFileRoute('/_app/_clinic/patients/new')({
  component: function NewPatient() {
    const navigate = Route.useNavigate();
    return (
      <RequirePermission permission="patients.manage">
        <RegisterPatientPage
          onRegistered={(patient) => {
            void navigate({ to: '/patients/$patientId', params: { patientId: patient.id } });
          }}
        />
      </RequirePermission>
    );
  },
});
