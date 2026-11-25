import { createFileRoute } from '@tanstack/react-router';

import { PatientsPage } from '@/features/patients/list/PatientsPage.tsx';

const PAGE_SIZES = [20, 50, 100];

// The address keeps the page, its size and "show archived". The search text never goes in it.
export const Route = createFileRoute('/_app/_clinic/patients/')({
  validateSearch: (search: Record<string, unknown>) => {
    const page = Number(search.page);
    const pageSize = Number(search.pageSize);
    return {
      ...(Number.isInteger(page) && page > 1 && { page }),
      ...(PAGE_SIZES.includes(pageSize) && pageSize !== 20 && { pageSize }),
      ...((search.includeArchived === true || search.includeArchived === 'true') && {
        includeArchived: true as const,
      }),
    };
  },
  component: function PatientList() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <PatientsPage
        search={search}
        onSearchChange={(next) => {
          void navigate({
            search: {
              ...(next.page !== undefined && { page: next.page }),
              ...(next.pageSize !== undefined && { pageSize: next.pageSize }),
              ...(next.includeArchived && { includeArchived: true as const }),
            },
          });
        }}
      />
    );
  },
});
