import { useLingui } from '@lingui/react/macro';
import { Check } from 'lucide-react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError } from '@/api/errors.ts';
import { useSession } from '@/api/session/session-store.ts';
import { Button } from '@/design-system/components/button.tsx';
import { EmptyState, ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { Tabs } from '@/design-system/components/tabs.tsx';
import { branchTimeZone, useBranches, type Branch } from '@/features/clinic/api/branches.ts';
import { useClinicProfile } from '@/features/clinic/api/tenant.ts';
import { usePractitioner } from '@/features/practitioners/api/practitioners.ts';
import { AppButtonLink } from '@/lib/app-link.tsx';
import { todayInZone } from '@/lib/datetime/index.ts';
import { formatPlainDate } from '@/lib/datetime/plain-date.ts';
import { can } from '@/lib/permissions.ts';
import { readPreference, writePreference } from '@/lib/preferences.ts';
import { useNow } from '@/lib/use-now.ts';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { DAY_TABS, type DaySearch, type DayTab } from './day-search.ts';
import { DayList } from './DayList.tsx';
import {
  BranchPicker,
  DayPickerBar,
  PractitionerFilter,
  usePractitionerChoices,
} from './DayFilters.tsx';

/** What each tab asks the API for; `all` asks for no status. */
const STATUSES: Record<DayTab | 'active', string | undefined> = {
  active: 'scheduled,checked_in',
  checked_in: 'checked_in',
  all: undefined,
  closed: 'cancelled,no_show',
};

/** The most the API gives at once: more branches than this is not a clinic this app serves. */
const ALL_BRANCHES = 100;

interface DayProps {
  search: DaySearch;
  onSearchChange: (next: DaySearch) => void;
}

function Day({
  search,
  onSearchChange,
  branches,
  clinicZone,
}: DayProps & { branches: [Branch, ...Branch[]]; clinicZone: string }) {
  const { t } = useLingui();
  const session = useSession();
  const permissions = session.status === 'signed-in' ? session.permissions : [];
  const mayReadDirectory = can(permissions, 'directory.read');
  const myProfileId =
    session.status === 'signed-in' && mayReadDirectory ? session.practitionerProfileId : null;
  const mine = usePractitioner(myProfileId ?? '').data;
  const practitioners = usePractitionerChoices({ enabled: mayReadDirectory });

  const remembered = readPreference('lastBranchId');
  const branch =
    branches.find((item) => item.id === search.branch) ??
    branches.find((item) => item.id === remembered) ??
    branches[0];
  const timeZone = branchTimeZone({ branch, clinicZone });
  const today = todayInZone({ timeZone, now: useNow() });
  const date = search.date ?? today;
  const tab = search.status ?? 'active';

  // A practitioner who works at several branches finds theirs first (P9-7).
  const myBranches = new Set(mine?.schedule.map((block) => block.branchId));
  const offered =
    myBranches.size > 1
      ? [...branches].sort((a, b) => Number(myBranches.has(b.id)) - Number(myBranches.has(a.id)))
      : branches;

  const change = (next: Partial<DaySearch>): void => {
    onSearchChange({ ...search, ...next });
  };
  const choosePractitioner = (membershipId: string): void => {
    change({ practitioner: membershipId || undefined });
  };

  const labels: Record<DayTab | 'active', string> = {
    active: t`Active`,
    checked_in: t`Checked in`,
    all: t`All`,
    closed: t`Cancelled and no-show`,
  };
  const chosenName = search.practitioner
    ? (practitioners.choices.find((choice) => choice.value === search.practitioner)?.label ??
      t`one practitioner`)
    : undefined;
  const filterNames =
    tab === 'all' && !chosenName ? [] : [labels[tab], ...(chosenName ? [chosenName] : [])];

  const list = (
    <DayList
      filters={{
        branchId: branch.id,
        date,
        practitionerMembershipId: search.practitioner,
        status: STATUSES[tab],
      }}
      timeZone={timeZone}
      filterNames={filterNames}
      onShowAll={() => {
        change({ practitioner: undefined, status: 'all' });
      }}
    />
  );
  const isMineShown = mine !== undefined && search.practitioner === mine.membershipId;

  const booking = `/appointments/new?branch=${branch.id}`;

  return (
    <>
      {can(permissions, 'appointments.manage') && (
        <div className="flex flex-wrap gap-3">
          <AppButtonLink href={`${booking}&date=${date}`}>{t`Book an appointment`}</AppButtonLink>
          {/* A walk-in is here now: it takes no day. */}
          <AppButtonLink href={`${booking}&kind=walk_in`} variant="secondary">
            {t`Register a walk-in`}
          </AppButtonLink>
        </div>
      )}
      <BranchPicker
        branches={offered}
        value={branch.id}
        onChange={(branchId) => {
          writePreference('lastBranchId', branchId);
          change({ branch: branchId });
        }}
      />
      <h2 className="text-h3">
        {formatPlainDate({ date, style: 'weekday' })}
        {date === today && ` · ${t`Today`}`}
      </h2>
      {timeZone !== clinicZone && <p>{t`Times are in ${timeZone}.`}</p>}
      <DayPickerBar
        date={date}
        today={today}
        onChange={(next) => {
          change({ date: next === today ? undefined : next });
        }}
      />
      {mayReadDirectory && (
        <div className="flex flex-wrap items-end gap-4">
          <PractitionerFilter
            choices={practitioners.choices}
            isLoaded={practitioners.isLoaded}
            value={search.practitioner ?? ''}
            onChange={choosePractitioner}
          />
          {mine && (
            <Button
              variant="secondary"
              aria-pressed={isMineShown}
              icon={isMineShown ? <Check className="size-5" /> : undefined}
              onClick={() => {
                choosePractitioner(isMineShown ? '' : mine.membershipId);
              }}
            >
              {t`My appointments`}
            </Button>
          )}
        </div>
      )}
      <Tabs
        label={t`Which appointments`}
        tabs={(['active', ...DAY_TABS] as const).map((value) => ({
          value,
          label: labels[value],
          content: list,
        }))}
        value={tab}
        onValueChange={(value) => {
          change({ status: DAY_TABS.find((item) => item === value) });
        }}
      />
    </>
  );
}

/** One branch's day, for the front desk (plans/09-appointments.md, 9.1). */
export function DayViewPage(props: DayProps) {
  const { t } = useLingui();
  usePageTitle(t`Appointments`);
  const branches = useBranches({ pageSize: ALL_BRANCHES });
  const clinic = useClinicProfile();

  function content() {
    const failed = branches.isError ? branches : clinic.isError ? clinic : undefined;
    if (failed && (!branches.data || !clinic.data)) {
      const error = asApiError(failed.error);
      return (
        <ErrorState
          message={messageForError(error)}
          requestId={error.requestId}
          onRetry={() => {
            void failed.refetch();
          }}
        />
      );
    }
    if (!branches.data || !clinic.data) return <LoadingState label={t`Loading appointments…`} />;
    const [first, ...rest] = branches.data.data;
    if (!first) return <EmptyState title={t`Add an active branch before booking appointments.`} />;
    return <Day {...props} branches={[first, ...rest]} clinicZone={clinic.data.timezone} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1>{t`Appointments`}</h1>
      {content()}
    </div>
  );
}
