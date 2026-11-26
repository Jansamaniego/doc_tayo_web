import { useLingui } from '@lingui/react/macro';
import { useRef, useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { asApiError, type ApiError } from '@/api/errors.ts';
import { sessionStore } from '@/api/session/session-store.ts';
import { Button } from '@/design-system/components/button.tsx';
import { ErrorState, LoadingState } from '@/design-system/components/state-views.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { FormErrorSummary } from '@/design-system/patterns/form-error-summary.tsx';
import { AppButtonLink } from '@/lib/app-link.tsx';
import { LeaveGuard } from '@/lib/leave-guard.tsx';
import { SaveFailure, useOpenedClinic } from '@/lib/opened-clinic.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { usePractitioner, useUpdatePractitioner, type Practitioner } from '../api/practitioners.ts';
import { isPractitionerNotFound, PractitionerNotFound } from '../record/PractitionerNotFound.tsx';
import { toChanges, toFormValues } from './practitioner-form-values.ts';
import { PractitionerFields } from './PractitionerFields.tsx';
import { usePractitionerForm } from './use-practitioner-form.ts';

function EditForm({ opened, onSaved }: { opened: Practitioner; onSaved: () => void }) {
  const { t } = useLingui();
  const clinic = useOpenedClinic();
  const update = useUpdatePractitioner();
  const model = usePractitionerForm(toFormValues(opened));
  const { isDirty } = model.form.formState;
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [nothingToChange, setNothingToChange] = useState(false);
  const [missing, setMissing] = useState(false);
  const saved = useRef(false);

  async function send(): Promise<void> {
    setFailure(undefined);
    setNothingToChange(false);
    const { values, problems } = model.check();
    if (problems.length > 0) {
      model.show(problems);
      return;
    }
    const changes = toChanges({ base: toFormValues(opened), values });
    if (Object.keys(changes).length === 0) {
      setNothingToChange(true);
      return;
    }
    try {
      await update.mutateAsync({ profileId: opened.id, tenantId: clinic.tenantId, changes });
      saved.current = true;
      notify.success(t`Changes saved.`);
      onSaved();
    } catch (error) {
      const apiError = asApiError(error);
      if (model.showApiProblems(apiError)) return;
      if (apiError.code === 'NOT_FOUND') setMissing(true);
      else setFailure(apiError);
    }
  }

  if (missing) return <PractitionerNotFound />;

  return (
    <div className="flex max-w-reading flex-col gap-6">
      <h1>{t`Edit practitioner`}</h1>
      <p className="break-words text-body-lg font-semibold">{opened.displayName}</p>
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <FormErrorSummary errors={model.summary} focusKey={model.attempt} />
        <PractitionerFields model={model} />
        {failure && <SaveFailure error={failure} openedIn={clinic} />}
        {nothingToChange && <p role="status">{t`Nothing to change.`}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" loading={update.isPending} loadingText={t`Saving…`}>
            {t`Save changes`}
          </Button>
          <AppButtonLink href={`/practitioners/${opened.id}`} variant="secondary">
            {t`Cancel`}
          </AppButtonLink>
        </div>
      </form>
      <LeaveGuard
        shouldBlock={() => !saved.current && sessionStore.get().status === 'signed-in' && isDirty}
      />
    </div>
  );
}

export function EditPractitionerPage({
  profileId,
  onSaved,
}: {
  profileId: string;
  onSaved: () => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Edit practitioner`);
  const practitioner = usePractitioner(profileId);
  // Kept from the first read: a clinic switched in another tab empties the cache and this profile is
  // "not found" there, but the form and what was typed must stay.
  const [opened, setOpened] = useState<Practitioner | undefined>();
  if (opened === undefined && practitioner.data) setOpened(practitioner.data);

  if (opened) return <EditForm opened={opened} onSaved={onSaved} />;
  if (practitioner.isError) {
    const error = asApiError(practitioner.error);
    if (isPractitionerNotFound(error)) return <PractitionerNotFound />;
    return (
      <ErrorState
        message={messageForError(error)}
        requestId={error.requestId}
        onRetry={() => {
          void practitioner.refetch();
        }}
      />
    );
  }
  return <LoadingState label={t`Loading the practitioner…`} />;
}
