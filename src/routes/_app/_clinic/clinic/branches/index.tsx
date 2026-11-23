import { createFileRoute } from '@tanstack/react-router';

import { RequirePermission } from '@/app/RequirePermission.tsx';
import { BranchesPage } from '@/features/clinic/branches/BranchesPage.tsx';

const STATUSES = ['inactive', 'all'] as const;
const PAGE_SIZES = [20, 50, 100];

// The address keeps the filter (Active is the default and is left out), the page and its size.
export const Route = createFileRoute('/_app/_clinic/clinic/branches/')({
  validateSearch: (search: Record<string, unknown>) => {
    const page = Number(search.page);
    const pageSize = Number(search.pageSize);
    return {
      ...(Number.isInteger(page) && page > 1 && { page }),
      ...(PAGE_SIZES.includes(pageSize) && pageSize !== 20 && { pageSize }),
      ...(STATUSES.find((status) => status === search.status) && {
        status: search.status as (typeof STATUSES)[number],
      }),
      ...(search.notice === 'missing' && { notice: 'missing' as const }),
    };
  },
  component: function Branches() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <RequirePermission permission="branches.read">
        <BranchesPage
          search={search}
          onSearchChange={(next) => {
            void navigate({
              search: {
                ...(next.page !== undefined && { page: next.page }),
                ...(next.pageSize !== undefined && { pageSize: next.pageSize }),
                ...(next.status !== undefined && { status: next.status }),
                ...(next.notice !== undefined && { notice: next.notice }),
              },
            });
          }}
        />
      </RequirePermission>
    );
  },
});
