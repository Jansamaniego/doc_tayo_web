import { createFileRoute } from '@tanstack/react-router';

import { PatientPage } from '@/features/patients/record/PatientPage.tsx';

export const Route = createFileRoute('/_app/_clinic/patients/$patientId')({
  component: function Patient() {
    const { patientId } = Route.useParams();
    // A new id is a new record: nothing of the previous one (such as "Copied") carries over.
    return <PatientPage key={patientId} patientId={patientId} />;
  },
});
