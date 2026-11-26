import { useLingui } from '@lingui/react/macro';
import { useRef, useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError, type ApiError } from '@/api/errors.ts';
import { sessionStore, useActiveTenantId } from '@/api/session/session-store.ts';
import { Button } from '@/design-system/components/button.tsx';
import { Combobox } from '@/design-system/components/select-fields.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { FormErrorSummary } from '@/design-system/patterns/form-error-summary.tsx';
import { useSessionController } from '@/features/auth/session-context.tsx';
import { AppButtonLink, AppLink } from '@/lib/app-link.tsx';
import { LeaveGuard } from '@/lib/leave-guard.tsx';
import { SaveFailure, useOpenedClinic } from '@/lib/opened-clinic.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useDirectory, type DirectoryEntry } from '../api/directory.ts';
import { useCreatePractitioner, type Practitioner } from '../api/practitioners.ts';
import { BackToPractitioners } from '../record/PractitionerNotFound.tsx';
import { EMPTY_PRACTITIONER, toNewProfile } from './practitioner-form-values.ts';
import { PractitionerFields } from './PractitionerFields.tsx';
import { usePractitionerForm } from './use-practitioner-form.ts';

/**
 * Makes an active member a practitioner (`POST /practitioners`). The role alone does not do it. The
 * display name starts as the person's name until it is typed over.
 */
export function NewPractitionerPage({
  onCreated,
}: {
  onCreated: (practitioner: Practitioner) => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Add a practitioner`);
  const clinic = useOpenedClinic();
  const controller = useSessionController();
  const directory = useDirectory();
  const create = useCreatePractitioner();
  const model = usePractitionerForm(EMPTY_PRACTITIONER);
  const { isDirty } = model.form.formState;
  const [membershipId, setMembershipId] = useState('');
  const [personError, setPersonError] = useState<string | undefined>();
  /** The member the API says already has a profile, to link to it. */
  const [already, setAlready] = useState<string | undefined>();
  const [failure, setFailure] = useState<ApiError | undefined>();
  /** The name last filled in for the person, so a typed one is never replaced. */
  const filled = useRef('');
  const created = useRef(false);

  // The staff of the clinic the form was opened in. A clinic switched in another tab reloads the
  // directory for the new one: the form, and what was typed, must stay with its own people.
  const activeTenantId = useActiveTenantId();
  const [staff, setStaff] = useState<DirectoryEntry[] | undefined>();
  if (directory.data && activeTenantId === clinic.tenantId && directory.data !== staff) {
    setStaff(directory.data);
  }
  const candidates = (staff ?? []).filter((entry) => entry.practitioner === null);
  const existing = staff?.find((entry) => entry.membershipId === already)?.practitioner;
  const personLabel = t`Person`;

  function choose(id: string): void {
    setMembershipId(id);
    setPersonError(undefined);
    setAlready(undefined);
    const name = candidates.find((entry) => entry.membershipId === id)?.fullName ?? '';
    const typed = model.form.getValues('displayName');
    if (typed === '' || typed === filled.current) {
      model.form.setValue('displayName', name, { shouldDirty: true });
      filled.current = name;
    }
  }

  /** The person cannot be added: say why under the field, and read the staff again. */
  function refusePerson(message: string): void {
    setPersonError(message);
    model.show([{ name: 'membershipId', label: personLabel, message }]);
    setMembershipId('');
    void directory.refetch();
  }

  function refused(error: ApiError): void {
    if (error.code === 'CONFLICT_UNIQUE') {
      setAlready(membershipId);
      refusePerson(t`This person is already a practitioner here.`);
    } else if (error.code === 'CONFLICT' || error.code === 'NOT_FOUND') {
      refusePerson(t`This person is no longer an active member.`);
    } else if (!model.showApiProblems(error)) {
      setFailure(error);
    }
  }

  async function send(): Promise<void> {
    setFailure(undefined);
    setPersonError(undefined);
    setAlready(undefined);
    const { values, problems } = model.check();
    if (membershipId === '') {
      const message = t`Choose the person.`;
      setPersonError(message);
      problems.unshift({ name: 'membershipId', label: personLabel, message });
    }
    if (problems.length > 0) {
      model.show(problems);
      return;
    }
    try {
      const practitioner = await create.mutateAsync({
        body: toNewProfile({ membershipId, values }),
        tenantId: clinic.tenantId,
      });
      created.current = true;
      const name = practitioner.displayName;
      const clinicName = clinic.name;
      notify.success(t`${name} is now a practitioner at ${clinicName}.`);
      // The manager may have added themselves: "My schedule" follows.
      void controller.refreshPermissions();
      onCreated(practitioner);
    } catch (error) {
      refused(asApiError(error));
    }
  }

  if (staff === undefined) {
    if (!directory.isError) return <LoadingState label={t`Loading the staff…`} />;
    const error = asApiError(directory.error);
    return (
      <ErrorState
        message={messageForError(error)}
        requestId={error.requestId}
        onRetry={() => {
          void directory.refetch();
        }}
      />
    );
  }
  if (candidates.length === 0 && personError === undefined) {
    return (
      <div className="flex max-w-reading flex-col gap-4">
        <BackToPractitioners />
        <h1>{t`Add a practitioner`}</h1>
        <p>{t`Everyone on your staff is already a practitioner.`}</p>
      </div>
    );
  }

  return (
    <div className="flex max-w-reading flex-col gap-6">
      <h1>{t`Add a practitioner`}</h1>
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <FormErrorSummary errors={model.summary} focusKey={model.attempt} />
        <Combobox
          label={personLabel}
          name="membershipId"
          hint={t`Active staff without a practitioner profile. Giving someone the Doctor role does not make them a practitioner.`}
          error={personError}
          options={candidates.map((entry) => ({
            value: entry.membershipId,
            label: [entry.fullName, entry.jobTitle].filter(Boolean).join(' · '),
          }))}
          value={membershipId}
          onChange={choose}
        />
        {existing && (
          <AppLink href={`/practitioners/${existing.profileId}`} standalone>
            {t`Open their practitioner page`}
          </AppLink>
        )}
        <PractitionerFields model={model} />
        {failure && <SaveFailure error={failure} openedIn={clinic} />}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" loading={create.isPending} loadingText={t`Saving…`}>
            {t`Add practitioner`}
          </Button>
          <AppButtonLink href="/practitioners" variant="secondary">
            {t`Cancel`}
          </AppButtonLink>
        </div>
      </form>
      <LeaveGuard
        shouldBlock={() =>
          !created.current &&
          // A session that ended must always reach the sign-in page.
          sessionStore.get().status === 'signed-in' &&
          (isDirty || membershipId !== '')
        }
      />
    </div>
  );
}
