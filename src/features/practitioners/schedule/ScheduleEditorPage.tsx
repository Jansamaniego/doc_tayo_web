import { useLingui } from '@lingui/react/macro';
import { useRef, useState } from 'react';

import { messageForError, messageForFieldError } from '@/api/error-messages.ts';
import { asApiError, type ApiError } from '@/api/errors.ts';
import { sessionStore, useActiveTenantId } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { ConfirmDialog } from '@/design-system/components/confirm-dialog.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { useBranches, type Branch } from '@/features/clinic/api/branches.ts';
import { useClinicTimeZone } from '@/features/staff/api/clinic-time-zone.ts';
import { AppButtonLink } from '@/lib/app-link.tsx';
import { weekdayName } from '@/lib/datetime/wall-time.ts';
import { LeaveGuard } from '@/lib/leave-guard.tsx';
import { SaveFailure, useOpenedClinic } from '@/lib/opened-clinic.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

import {
  useFreshPractitioner,
  useReplaceSchedule,
  type Practitioner,
} from '../api/practitioners.ts';
import { isPractitionerNotFound, PractitionerNotFound } from '../record/PractitionerNotFound.tsx';
import { CopyHoursDialog, WEEKDAYS } from './CopyHoursDialog.tsx';
import { DayHours, fieldName } from './DayHours.tsx';
import {
  checkWeek,
  copyDay,
  isSameWeek,
  MAX_BLOCKS,
  rowOfApiField,
  sortWeek,
  toBlocks,
  toDraft,
  type BlockPart,
  type DraftBlock,
  type WeekProblem,
} from './schedule-rules.ts';

/** The most the API gives at once: more branches than this is not a clinic this app serves. */
const ALL_BRANCHES = 100;

interface EditorBranches {
  list: Branch[];
  clinicZone: string;
  /** Reads them again, after the API refused one. */
  reload: () => void;
}

function Editor({
  opened,
  branches,
  readAgain,
  onSaved,
}: {
  opened: Practitioner;
  branches: EditorBranches;
  /** Asks for the profile again and says what went wrong, if anything. */
  readAgain: () => Promise<{ error: unknown }>;
  onSaved: () => void;
}) {
  const { t } = useLingui();
  const clinic = useOpenedClinic();
  const replace = useReplaceSchedule();
  const [original] = useState(() => toDraft(opened.schedule));
  const [draft, setDraft] = useState(original);
  /** Messages by field name; they stay until the next press of Save. */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [notice, setNotice] = useState<'unchanged' | 'branchGone' | undefined>();
  const [askingEmpty, setAskingEmpty] = useState(false);
  const [copying, setCopying] = useState<number | undefined>();
  const [missing, setMissing] = useState(false);
  const added = useRef(0);
  const saved = useRef(false);
  const newKey = () => `new-${(added.current += 1)}`;
  const active = branches.list.filter((branch) => branch.isActive);
  const name = opened.displayName;

  const branchLabel = (branch: Branch): string =>
    branch.timezone !== null && branch.timezone !== branches.clinicZone
      ? `${branch.name} (${branch.timezone})`
      : branch.name;
  const branchOptions = (branchId: string) => {
    const options = active.map((branch) => ({ value: branch.id, label: branchLabel(branch) }));
    if (branchId === '' || active.some((branch) => branch.id === branchId)) return options;
    const own = branches.list.find((branch) => branch.id === branchId);
    const ownName = own?.name ?? t`Unknown branch`;
    return [...options, { value: branchId, label: t`${ownName} (no longer active)` }];
  };

  /** "Monday, hours 2: start", as the field itself is labelled. */
  function labelOf({ key, part }: { key: string; part: BlockPart }): string {
    const weekday = draft.find((item) => item.key === key)?.weekday ?? 1;
    const day = weekdayName(weekday);
    const ofDay = draft.filter((item) => item.weekday === weekday);
    const number = ofDay.findIndex((item) => item.key === key) + 1;
    const hours = t`${day}, hours ${number}`;
    if (part === 'branchId') return t`${hours}: branch`;
    return part === 'startsAt' ? t`${hours}: start` : t`${hours}: end`;
  }

  function messageOf(problem: WeekProblem): string {
    if (problem.kind === 'tooMany') {
      const most = MAX_BLOCKS;
      const count = draft.length;
      return t`A week can have at most ${most} blocks of hours. This one has ${count}.`;
    }
    if (problem.kind === 'inactive') return t`This branch is no longer active.`;
    if (problem.kind === 'order') return t`The end must be after the start.`;
    if (problem.kind === 'overlap') return t`These hours overlap other hours on this day.`;
    if (problem.part === 'branchId') return t`Choose the branch.`;
    return problem.part === 'startsAt' ? t`Choose the start time.` : t`Choose the end time.`;
  }

  /** Shows each message under its field and in the summary, in the order of the week. */
  function show(entries: SummaryEntry[]): void {
    const order = sortOrder();
    const sorted = [...entries].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    setErrors(Object.fromEntries(sorted.map((entry) => [entry.name, entry.message])));
    setSummary(sorted);
    setAttempt((count) => count + 1);
  }

  /** Every field name as it appears on the page. */
  function sortOrder(): string[] {
    return WEEKDAYS.flatMap((weekday) =>
      draft
        .filter((block) => block.weekday === weekday)
        .flatMap(({ key }) =>
          (['branchId', 'startsAt', 'endsAt'] as const).map((part) => fieldName({ key, part })),
        ),
    );
  }

  /** The API's field errors on the rows that were sent. */
  function showApiProblems({ error, sent }: { error: ApiError; sent: DraftBlock[] }): void {
    show(
      error.details.map((detail) => {
        const row = rowOfApiField({ field: detail.field, sent });
        if (!row) {
          return { name: 'week', label: t`Weekly schedule`, message: messageForFieldError(detail) };
        }
        let message = messageForFieldError(detail);
        if (detail.code === 'INVALID_VALUE') {
          const kind = { branchId: 'inactive', startsAt: 'overlap', endsAt: 'order' } as const;
          message = messageOf({ ...row, kind: kind[row.part] });
        }
        return { name: fieldName(row), label: labelOf(row), message };
      }),
    );
    if (error.details.some((detail) => detail.field.endsWith('branchId'))) branches.reload();
  }

  /** `404` is the profile or one of the branches; the answer does not say which. */
  async function explainNotFound(): Promise<void> {
    const again = await readAgain();
    if (!again.error) {
      setNotice('branchGone');
      branches.reload();
      return;
    }
    const error = asApiError(again.error);
    if (isPractitionerNotFound(error)) setMissing(true);
    else setFailure(error);
  }

  async function send(): Promise<void> {
    const sent = sortWeek(draft);
    try {
      await replace.mutateAsync({
        profileId: opened.id,
        tenantId: clinic.tenantId,
        blocks: toBlocks(sent),
      });
      saved.current = true;
      notify.success(t`Weekly schedule saved.`);
      onSaved();
    } catch (error) {
      const apiError = asApiError(error);
      if (apiError.code === 'NOT_FOUND') await explainNotFound();
      else if (apiError.code === 'VALIDATION_FAILED' && apiError.details.length > 0) {
        showApiProblems({ error: apiError, sent });
      } else setFailure(apiError);
    }
  }

  function save(): void {
    setFailure(undefined);
    setNotice(undefined);
    const problems = checkWeek({ draft, activeBranchIds: active.map((branch) => branch.id) });
    show(
      problems.map((problem) =>
        problem.part === 'week'
          ? { name: 'week', label: t`Weekly schedule`, message: messageOf(problem) }
          : { name: fieldName(problem), label: labelOf(problem), message: messageOf(problem) },
      ),
    );
    if (problems.length > 0) return;
    if (isSameWeek(draft, original)) setNotice('unchanged');
    else if (draft.length === 0) setAskingEmpty(true);
    else void send();
  }

  if (missing) return <PractitionerNotFound />;

  return (
    <div className="flex max-w-reading flex-col gap-6">
      <h1>{t`Edit weekly schedule`}</h1>
      <p className="break-words text-body-lg font-semibold">{name}</p>
      <p>{t`Times are the local time of each branch.`}</p>
      {active.length === 0 && (
        <Alert variant="warning">{t`Add an active branch before adding hours.`}</Alert>
      )}
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <FormErrorSummary errors={summary} focusKey={attempt} />
        {WEEKDAYS.map((weekday) => (
          <DayHours
            key={weekday}
            weekday={weekday}
            blocks={draft.filter((block) => block.weekday === weekday)}
            branchOptions={branchOptions}
            errorOf={(field) => errors[field]}
            onChange={(changed) => {
              setDraft((week) => week.map((item) => (item.key === changed.key ? changed : item)));
            }}
            onRemove={(key) => {
              setDraft((week) => week.filter((item) => item.key !== key));
            }}
            onAdd={
              active.length === 0
                ? undefined
                : () => {
                    const [only, second] = active;
                    const block = {
                      key: newKey(),
                      weekday,
                      branchId: only && !second ? only.id : '',
                      startsAt: '',
                      endsAt: '',
                      untilMidnight: false,
                    };
                    setDraft((week) => [...week, block]);
                  }
            }
            onCopy={() => {
              setCopying(weekday);
            }}
          />
        ))}
        {failure && <SaveFailure error={failure} openedIn={clinic} />}
        {notice === 'branchGone' && (
          <Alert variant="warning">
            {t`A branch in this schedule no longer exists. Check the branches and save again.`}
          </Alert>
        )}
        {notice === 'unchanged' && <p role="status">{t`Nothing to change.`}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" loading={replace.isPending} loadingText={t`Saving…`}>
            {t`Save schedule`}
          </Button>
          <AppButtonLink href={`/practitioners/${opened.id}`} variant="secondary">
            {t`Cancel`}
          </AppButtonLink>
        </div>
      </form>
      {copying !== undefined && (
        <CopyHoursDialog
          from={copying}
          daysWithHours={[...new Set(draft.map((block) => block.weekday))]}
          onClose={() => {
            setCopying(undefined);
          }}
          onCopy={(to) => {
            setDraft((week) => copyDay({ draft: week, from: copying, to, newKey }));
            setCopying(undefined);
          }}
        />
      )}
      {askingEmpty && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setAskingEmpty(false);
          }}
          title={t`Save an empty week?`}
          description={t`${name} will have no working hours.`}
          confirmLabel={t`Save empty week`}
          onConfirm={() => {
            void send();
          }}
        />
      )}
      <LeaveGuard
        shouldBlock={() =>
          !saved.current &&
          // A session that ended must always reach the sign-in page.
          sessionStore.get().status === 'signed-in' &&
          !isSameWeek(draft, original)
        }
      />
    </div>
  );
}

export function ScheduleEditorPage({
  profileId,
  onSaved,
}: {
  profileId: string;
  onSaved: () => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Edit weekly schedule`);
  const clinic = useOpenedClinic();
  const activeTenantId = useActiveTenantId();
  const practitioner = useFreshPractitioner(profileId);
  // Inactive branches too: a saved week may still name one.
  const branches = useBranches({ status: 'all', pageSize: ALL_BRANCHES });
  const clinicZone = useClinicTimeZone();

  // Both are kept for the clinic the editor was opened in: a switch in another tab must not remove
  // the week being edited, nor offer the other clinic's branches.
  const [opened, setOpened] = useState<Practitioner | undefined>();
  const [list, setList] = useState<{ list: Branch[]; clinicZone: string } | undefined>();
  const here = activeTenantId === clinic.tenantId;
  if (
    opened === undefined &&
    here &&
    practitioner.isFetchedAfterMount &&
    practitioner.isSuccess &&
    !practitioner.isFetching
  ) {
    setOpened(practitioner.data);
  }
  const read = branches.data?.data;
  if (here && read && clinicZone && read !== list?.list) setList({ list: read, clinicZone });

  if (opened && list) {
    return (
      <Editor
        opened={opened}
        branches={{
          ...list,
          reload: () => {
            void branches.refetch();
          },
        }}
        readAgain={() => practitioner.refetch()}
        onSaved={onSaved}
      />
    );
  }
  const failed = practitioner.isError ? practitioner : branches.isError ? branches : undefined;
  if (failed) {
    const error = asApiError(failed.error);
    if (failed === practitioner && isPractitionerNotFound(error)) return <PractitionerNotFound />;
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
  return <LoadingState label={t`Loading the schedule…`} />;
}
