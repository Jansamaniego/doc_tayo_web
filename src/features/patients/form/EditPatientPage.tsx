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
import { usePageTitle } from '@/lib/use-page-title.ts';

import { fetchPatient, usePatient, useUpdatePatient, type Patient } from '../api/patients.ts';
import { patientFullName } from '../patient-name.ts';
import { ArchivedBanner } from '../record/ArchivedBanner.tsx';
import { isPatientNotFound, PatientNotFound } from '../record/PatientNotFound.tsx';
import { SaveFailure, useOpenedClinic } from './opened-clinic.tsx';
import { PatientFields } from './PatientFields.tsx';
import { PATIENT_FIELDS, toChanges, toFormValues } from './patient-form-values.ts';
import { usePatientForm } from './use-patient-form.ts';
import { VersionConflictNotice, type TheirChange } from './VersionConflictNotice.tsx';

/**
 * Edits a patient (`PATCH /patients/:id`): only what changed, with the version the form is based on.
 * If someone else saved first, the record is read again, their changes are listed, the person's own
 * stay on the form, and nothing is saved until they press Save again (P6-7).
 */
function EditForm({ opened, onSaved }: { opened: Patient; onSaved: () => void }) {
  const { t } = useLingui();
  const clinic = useOpenedClinic();
  const update = useUpdatePatient();
  /** The record the form is based on: its values and version are what "changed" is measured against. */
  const [base, setBase] = useState(opened);
  const model = usePatientForm(toFormValues(opened));
  const { isDirty } = model.form.formState;
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [theirs, setTheirs] = useState<TheirChange[] | undefined>();
  const [nothingToChange, setNothingToChange] = useState(false);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);
  const saved = useRef(false);

  function refused(error: ApiError): void {
    if (model.showApiProblems(error)) return;
    if (error.code === 'NOT_FOUND') setMissing(true);
    else setFailure(error);
  }

  /** Someone else saved first: base the form on their record, keeping this person's changes. */
  async function takeTheirs(): Promise<void> {
    const latest = await fetchPatient({ patientId: base.id, tenantId: clinic.tenantId });
    const before = toFormValues(base);
    const now = toFormValues(latest);
    const typed = model.form.getValues();
    const mine = PATIENT_FIELDS.filter((name) => typed[name].trim() !== before[name].trim());
    setTheirs(
      PATIENT_FIELDS.filter((name) => now[name] !== before[name]).map((name) => ({
        field: name,
        before: before[name],
        now: now[name],
        alsoMine: mine.includes(name) && typed[name].trim() !== now[name],
      })),
    );
    model.rebase({
      saved: now,
      mine: Object.fromEntries(mine.map((name) => [name, typed[name]])),
    });
    setBase(latest);
  }

  async function send(): Promise<void> {
    setFailure(undefined);
    setNothingToChange(false);
    const values = model.validate({ savedBirthDate: base.birthDate ?? '' });
    if (!values) return;
    const changes = toChanges({ base: toFormValues(base), values });
    if (Object.keys(changes).length === 0) {
      setNothingToChange(true);
      return;
    }
    setSaving(true);
    setTheirs(undefined);
    try {
      await update.mutateAsync({
        patientId: base.id,
        tenantId: clinic.tenantId,
        version: base.version,
        changes,
      });
      saved.current = true;
      notify.success(t`Changes saved.`);
      onSaved();
    } catch (error) {
      const apiError = asApiError(error);
      if (apiError.code === 'VERSION_CONFLICT') {
        await takeTheirs().catch((readError: unknown) => {
          refused(asApiError(readError));
        });
      } else {
        refused(apiError);
      }
    } finally {
      setSaving(false);
    }
  }

  if (missing) return <PatientNotFound />;
  const name = patientFullName(base);

  return (
    <div className="flex max-w-reading flex-col gap-6">
      <h1>{t`Edit patient`}</h1>
      <p className="break-words text-body-lg font-semibold">
        {name} · {base.patientNumber}
      </p>
      <ArchivedBanner patient={base} />
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        {theirs && <VersionConflictNotice changes={theirs} labels={model.labels} />}
        <FormErrorSummary errors={model.summary} focusKey={model.attempt} />
        <PatientFields model={model} />
        {failure && <SaveFailure error={failure} openedIn={clinic} />}
        {nothingToChange && <p role="status">{t`Nothing to change.`}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" loading={saving} loadingText={t`Saving…`}>
            {t`Save changes`}
          </Button>
          <AppButtonLink href={`/patients/${base.id}`} variant="secondary">
            {t`Cancel`}
          </AppButtonLink>
        </div>
      </form>
      <LeaveGuard
        shouldBlock={() =>
          !saved.current &&
          // A session that ended must always reach the sign-in page.
          sessionStore.get().status === 'signed-in' &&
          (isDirty || model.birthIncompleteRef.current)
        }
      />
    </div>
  );
}

export function EditPatientPage({
  patientId,
  onSaved,
}: {
  patientId: string;
  onSaved: () => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Edit patient`);
  const patient = usePatient(patientId);
  // Kept from the first read: a clinic switched in another tab empties the cache and this patient is
  // "not found" there, but the form and what was typed must stay.
  const [opened, setOpened] = useState<Patient | undefined>();
  if (opened === undefined && patient.data) setOpened(patient.data);

  if (opened) return <EditForm opened={opened} onSaved={onSaved} />;
  if (patient.isError) {
    const error = asApiError(patient.error);
    if (isPatientNotFound(error)) return <PatientNotFound />;
    return (
      <ErrorState
        message={messageForError(error)}
        requestId={error.requestId}
        onRetry={() => {
          void patient.refetch();
        }}
      />
    );
  }
  return <LoadingState label={t`Loading the patient…`} />;
}
