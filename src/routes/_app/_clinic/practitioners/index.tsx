import { createFileRoute } from '@tanstack/react-router';

import { PractitionersPage } from '@/features/practitioners/list/PractitionersPage.tsx';

const PAGE_SIZES = [20, 50, 100];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The address keeps the page, its size and the branch. Every key is returned, as undefined when it is
// not usable: the router would otherwise pass the raw value on (a branch that is not an id would reach
// the API and be refused).
export const Route = createFileRoute('/_app/_clinic/practitioners/')({
  validateSearch: (search: Record<string, unknown>) => {
    const page = Number(search.page);
    const pageSize = Number(search.pageSize);
    const { branch } = search;
    return {
      page: Number.isInteger(page) && page > 1 ? page : undefined,
      pageSize: PAGE_SIZES.includes(pageSize) && pageSize !== 20 ? pageSize : undefined,
      branch: typeof branch === 'string' && UUID.test(branch) ? branch : undefined,
    };
  },
  component: function PractitionerList() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <PractitionersPage
        search={search}
        onSearchChange={(next) => {
          void navigate({
            search: {
              page: next.page !== undefined && next.page > 1 ? next.page : undefined,
              pageSize: next.pageSize,
              branch: next.branch,
            },
          });
        }}
      />
    );
  },
});
