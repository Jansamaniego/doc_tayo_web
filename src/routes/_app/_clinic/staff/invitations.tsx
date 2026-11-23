import { createFileRoute } from '@tanstack/react-router';

import { InvitationsPage } from '@/features/staff/invitations/InvitationsPage.tsx';

const STATUSES = ['accepted', 'revoked', 'expired'] as const;
const PAGE_SIZES = [20, 50, 100];

// The address keeps the status (Pending is the default and is left out), the page and its size.
export const Route = createFileRoute('/_app/_clinic/staff/invitations')({
  validateSearch: (search: Record<string, unknown>) => {
    const page = Number(search.page);
    const pageSize = Number(search.pageSize);
    return {
      ...(Number.isInteger(page) && page > 1 && { page }),
      ...(PAGE_SIZES.includes(pageSize) && pageSize !== 20 && { pageSize }),
      ...(STATUSES.find((status) => status === search.status) && {
        status: search.status as (typeof STATUSES)[number],
      }),
    };
  },
  component: function Invitations() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <InvitationsPage
        search={search}
        onSearchChange={(next) => {
          void navigate({
            search: {
              ...(next.page !== undefined && { page: next.page }),
              ...(next.pageSize !== undefined && { pageSize: next.pageSize }),
              ...(next.status !== undefined && { status: next.status }),
            },
          });
        }}
      />
    );
  },
});
