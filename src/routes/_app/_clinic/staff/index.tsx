import { createFileRoute } from '@tanstack/react-router';

import { StaffListPage } from '@/features/staff/members/StaffListPage.tsx';

const STATUSES = ['active', 'suspended', 'removed'] as const;
const PAGE_SIZES = [20, 50, 100];

// The address keeps the page, the page size and the status. The search text never goes in it.
export const Route = createFileRoute('/_app/_clinic/staff/')({
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
  component: function StaffList() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <StaffListPage
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
    );
  },
});
