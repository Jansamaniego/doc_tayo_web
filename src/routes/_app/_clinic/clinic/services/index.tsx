import { createFileRoute } from '@tanstack/react-router';
import { useCallback } from 'react';

import { RequirePermission } from '@/app/RequirePermission.tsx';
import { ServicesPage } from '@/features/services/list/ServicesPage.tsx';

const PAGE_SIZES = [20, 50, 100];

// The address keeps the page, its size and "show inactive". Every key is returned, as undefined when
// it is not usable: the router would otherwise pass the raw value on to the API.
export const Route = createFileRoute('/_app/_clinic/clinic/services/')({
  validateSearch: (search: Record<string, unknown>) => {
    const page = Number(search.page);
    const pageSize = Number(search.pageSize);
    return {
      page: Number.isSafeInteger(page) && page > 1 ? page : undefined,
      pageSize: PAGE_SIZES.includes(pageSize) && pageSize !== 20 ? pageSize : undefined,
      inactive: search.inactive === 1 ? (1 as const) : undefined,
    };
  },
  component: function Services() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const toLastPage = useCallback(
      (lastPage: number) => {
        void navigate({
          search: (previous) => ({ ...previous, page: lastPage > 1 ? lastPage : undefined }),
          replace: true,
        });
      },
      [navigate],
    );
    return (
      <RequirePermission permission="services.read">
        <ServicesPage
          search={search}
          onPageGone={toLastPage}
          onSearchChange={(next) => {
            void navigate({
              search: {
                page: next.page !== undefined && next.page > 1 ? next.page : undefined,
                pageSize: next.pageSize,
                inactive: next.inactive,
              },
            });
          }}
        />
      </RequirePermission>
    );
  },
});
