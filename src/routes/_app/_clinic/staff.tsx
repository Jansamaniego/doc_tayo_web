import { createFileRoute, Outlet } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';

export const Route = createFileRoute('/_app/_clinic/staff')({
  component: function Staff() {
    return (
      <RequirePermission permission="members.read">
        <Outlet />
      </RequirePermission>
    );
  },
});
