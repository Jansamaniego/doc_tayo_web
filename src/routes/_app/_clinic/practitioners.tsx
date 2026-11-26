import { createFileRoute, Outlet } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';

export const Route = createFileRoute('/_app/_clinic/practitioners')({
  component: function Practitioners() {
    return (
      <RequirePermission permission="directory.read">
        <Outlet />
      </RequirePermission>
    );
  },
});
