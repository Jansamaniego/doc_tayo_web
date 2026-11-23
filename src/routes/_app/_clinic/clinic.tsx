import { createFileRoute, Outlet } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';

// Every clinic role holds tenant.read; the gate keeps the rule in one place, like Staff.
export const Route = createFileRoute('/_app/_clinic/clinic')({
  component: function Clinic() {
    return (
      <RequirePermission permission="tenant.read">
        <Outlet />
      </RequirePermission>
    );
  },
});
