import { useLingui } from '@lingui/react/macro';
import { useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';

import { asApiError, type ApiError } from '@/api/errors.ts';
import { createIdempotentAction } from '@/api/idempotency.ts';
import { sessionStore } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { Button } from '@/design-system/components/button.tsx';
import { notify } from '@/design-system/components/toast.tsx';
import { FormErrorSummary } from '@/design-system/patterns/form-error-summary.tsx';
import { AppButtonLink } from '@/lib/app-link.tsx';
import { LeaveGuard } from '@/lib/leave-guard.tsx';
import { usePageTitle } from '@/lib/use-page-title.ts';

import { useRegisterPatient, type Patient } from '../api/patients.ts';
import { patientFullName } from '../patient-name.ts';
import { DuplicateCandidates } from './DuplicateCandidates.tsx';
import { SaveFailure, useOpenedClinic } from './opened-clinic.tsx';
import { PatientFields } from './PatientFields.tsx';
import { EMPTY_PATIENT, toCreateRequest } from './patient-form-values.ts';
import { usePatientForm } from './use-patient-form.ts';

/**
 * Registers a patient (`POST /patients`). One idempotency key for the action, reused until it
 * succeeds, so a double tap or a retry registers one patient; likely existing records are shown while
 * typing and never block.
 */
export function RegisterPatientPage({
  onRegistered,
}: {
  onRegistered: (patient: Patient) => void;
}) {
  const { t } = useLingui();
  usePageTitle(t`Register a patient`);
  const clinic = useOpenedClinic();
  const register = useRegisterPatient();
  const [action, setAction] = useState(() => createIdempotentAction());
  const model = usePatientForm(EMPTY_PATIENT);
  const { control } = model.form;
  const { isDirty } = model.form.formState;
  const [firstName, lastName, birthDate, phone] = useWatch({
    control,
    name: ['firstName', 'lastName', 'birthDate', 'phone'],
  });
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [saving, setSaving] = useState(false);
  /** The server says this key was already used: the patient may exist (P6-5). */
  const [mayExist, setMayExist] = useState(false);
  const [duplicateRound, setDuplicateRound] = useState(0);
  const registered = useRef(false);

  function refused(error: ApiError): void {
    if (model.showApiProblems(error)) return;
    if (error.code === 'IDEMPOTENCY_KEY_REUSED') {
      setMayExist(true);
      setDuplicateRound((round) => round + 1);
    } else {
      setFailure(error);
    }
  }

  async function send(run: typeof action): Promise<void> {
    setFailure(undefined);
    const values = model.validate({ savedBirthDate: '' });
    if (!values) return;
    setSaving(true);
    try {
      const patient = await run((idempotencyKey) =>
        register.mutateAsync({
          body: toCreateRequest(values),
          tenantId: clinic.tenantId,
          idempotencyKey,
        }),
      );
      registered.current = true;
      setMayExist(false);
      const name = patientFullName(patient);
      notify.success(t`${name} is registered as ${patient.patientNumber}.`);
      onRegistered(patient);
    } catch (error) {
      refused(asApiError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1>{t`Register a patient`}</h1>
      <form
        noValidate
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!mayExist) void send(action);
        }}
      >
        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1">
          <FormErrorSummary errors={model.summary} focusKey={model.attempt} />
          <PatientFields model={model} />
        </div>

        {/* Beside the form on a wide screen, above the button on a narrow one. */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1">
          <DuplicateCandidates
            tenantId={clinic.tenantId}
            query={{ firstName, lastName, birthDate, phone }}
            round={duplicateRound}
          />
        </div>

        <div className="flex flex-col gap-4 lg:col-start-1">
          {mayExist && (
            <Alert variant="warning">
              {t`This patient may already have been registered. Check the matching records before registering again.`}
            </Alert>
          )}
          {failure && <SaveFailure error={failure} openedIn={clinic} />}
          <div className="flex flex-wrap gap-3">
            {mayExist ? (
              <Button
                // A different element from "Register patient", so a press meant for one never submits.
                key="anew"
                size="lg"
                loading={saving}
                loadingText={t`Saving…`}
                onClick={() => {
                  const fresh = createIdempotentAction();
                  setAction(() => fresh);
                  setMayExist(false);
                  void send(fresh);
                }}
              >
                {t`Register as a new patient`}
              </Button>
            ) : (
              <Button
                key="register"
                type="submit"
                size="lg"
                loading={saving}
                loadingText={t`Saving…`}
              >
                {t`Register patient`}
              </Button>
            )}
            <AppButtonLink href="/patients" variant="secondary">
              {t`Cancel`}
            </AppButtonLink>
          </div>
        </div>
      </form>
      <LeaveGuard
        shouldBlock={() =>
          !registered.current &&
          // A session that ended must always reach the sign-in page.
          sessionStore.get().status === 'signed-in' &&
          (isDirty || model.birthIncompleteRef.current)
        }
      />
    </div>
  );
}
