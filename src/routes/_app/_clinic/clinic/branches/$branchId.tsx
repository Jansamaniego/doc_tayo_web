import { createFileRoute } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';
import { BranchPage } from '@/features/clinic/branches/BranchPage.tsx';

export const Route = createFileRoute('/_app/_clinic/clinic/branches/$branchId')({
  component: function Branch() {
    const { branchId } = Route.useParams();
    const navigate = Route.useNavigate();
    return (
      <RequirePermission permission="branches.read">
        <BranchPage
          branchId={branchId}
          onMissing={() => {
            void navigate({ to: '/clinic/branches', search: { notice: 'missing' } });
          }}
        />
      </RequirePermission>
    );
  },
});
