import { createFileRoute } from '@tanstack/react-router';

import { DAY_TABS } from '@/features/appointments/day/day-search.ts';
import { DayViewPage } from '@/features/appointments/day/DayViewPage.tsx';
import { parsePlainDate } from '@/lib/datetime/plain-date.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (value: unknown): string | undefined =>
  typeof value === 'string' && UUID.test(value) ? value : undefined;

// Every key is returned, as undefined when it is not usable: the router would otherwise pass the raw
// value on to the API.
export const Route = createFileRoute('/_app/_clinic/appointments/')({
  validateSearch: (search: Record<string, unknown>) => {
    const { date } = search;
    return {
      branch: id(search.branch),
      date: typeof date === 'string' && parsePlainDate(date) ? date : undefined,
      practitioner: id(search.practitioner),
      status: DAY_TABS.find((tab) => tab === search.status),
    };
  },
  component: function DayView() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <DayViewPage
        search={search}
        onSearchChange={({ branch, date, practitioner, status }) => {
          void navigate({ search: { branch, date, practitioner, status } });
        }}
      />
    );
  },
});
