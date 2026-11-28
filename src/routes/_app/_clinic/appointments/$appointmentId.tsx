import { createFileRoute } from '@tanstack/react-router';

import { AppointmentPage } from '@/features/appointments/record/AppointmentPage.tsx';

export const Route = createFileRoute('/_app/_clinic/appointments/$appointmentId')({
  component: function AppointmentRecord() {
    const { appointmentId } = Route.useParams();
    return <AppointmentPage key={appointmentId} appointmentId={appointmentId} />;
  },
});
