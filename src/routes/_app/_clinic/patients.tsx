import { createFileRoute, Outlet } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';

export const Route = createFileRoute('/_app/_clinic/patients')({
  component: function Patients() {
    return (
      <RequirePermission permission="patients.read">
        <Outlet />
      </RequirePermission>
    );
  },
});
