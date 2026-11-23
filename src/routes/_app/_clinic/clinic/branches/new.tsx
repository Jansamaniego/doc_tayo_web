import { createFileRoute } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';
import { NewBranchPage } from '@/features/clinic/branches/NewBranchPage.tsx';

export const Route = createFileRoute('/_app/_clinic/clinic/branches/new')({
  component: function NewBranch() {
    const navigate = Route.useNavigate();
    return (
      <RequirePermission permission="branches.manage">
        <NewBranchPage
          onCreated={({ id }) => {
            void navigate({ to: '/clinic/branches/$branchId', params: { branchId: id } });
          }}
        />
      </RequirePermission>
    );
  },
});
