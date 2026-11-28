import { createFileRoute, Outlet } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';

export const Route = createFileRoute('/_app/_clinic/appointments')({
  component: function Appointments() {
    return (
      <RequirePermission permission="appointments.read">
        <Outlet />
      </RequirePermission>
    );
  },
});
