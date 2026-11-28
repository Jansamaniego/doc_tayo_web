import { createFileRoute } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';
import { BookAppointmentPage } from '@/features/appointments/form/BookAppointmentPage.tsx';
import { parsePlainDate } from '@/lib/datetime/plain-date.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value: unknown): string | undefined =>
  typeof value === 'string' && UUID.test(value) ? value : undefined;

// The address fills the form with ids only. A value that is not usable is dropped.
export const Route = createFileRoute('/_app/_clinic/appointments/new')({
  validateSearch: (search: Record<string, unknown>) => {
    const { date, kind } = search;
    return {
      branch: id(search.branch),
      date: typeof date === 'string' && parsePlainDate(date) ? date : undefined,
      patient: id(search.patient),
      kind: kind === 'walk_in' ? ('walk_in' as const) : undefined,
    };
  },
  component: function Book() {
    const prefill = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <RequirePermission permission="appointments.manage">
        <BookAppointmentPage
          prefill={prefill}
          onBooked={(appointment) => {
            void navigate({
              to: '/appointments/$appointmentId',
              params: { appointmentId: appointment.id },
            });
          }}
        />
      </RequirePermission>
    );
  },
});
