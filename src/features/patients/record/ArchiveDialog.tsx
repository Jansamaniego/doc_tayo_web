import { useLingui } from '@lingui/react/macro';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';

import { asApiError, type ApiError } from '@/api/errors.ts';
import { Button } from '@/design-system/components/button.tsx';
import { Dialog } from '@/design-system/components/dialog.tsx';
import { TextField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { applyApiErrors } from '@/lib/api-form-errors.ts';

import { useArchivePatient, type Patient } from '../api/patients.ts';
import { SaveFailure, useOpenedClinic } from '../form/opened-clinic.tsx';
import { patientFullName } from '../patient-name.ts';

const MAX_REASON = 200;
const FORM_ID = 'archive-patient-form';
/** Answers that mean the record on screen is out of date: the page reads it again and says why. */
const STALE_CODES = ['CONFLICT', 'VERSION_CONFLICT', 'NOT_FOUND'];

/** Asks why, then archives (`POST …/archive`). Mounted only while open. */
export function ArchiveDialog({
  patient,
  onClose,
  onArchived,
  onStale,
}: {
  patient: Patient;
  onClose: () => void;
  onArchived: () => void;
  /** Someone else changed, archived or removed the patient meanwhile. */
  onStale: (error: ApiError) => void;
}) {
  const { t } = useLingui();
  const clinic = useOpenedClinic();
  const archive = useArchivePatient();
  const { register, getValues, setError, clearErrors, formState } = useForm<{ reason: string }>({
    defaultValues: { reason: '' },
  });
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<ApiError | undefined>();
  // The safe choice has the focus when the dialog opens (once: the callback never changes).
  const focusFirst = useCallback((node: HTMLButtonElement | null) => {
    node?.focus();
  }, []);
  const label = t`Reason`;
  const name = patientFullName(patient);

  function show(problems: SummaryEntry[]): void {
    setSummary(problems);
    setAttempt((count) => count + 1);
  }

  async function send(): Promise<void> {
    clearErrors();
    setSummary([]);
    setFailure(undefined);
    const reason = getValues('reason').trim();
    let problem: string | undefined;
    if (reason === '') problem = t`Say why this patient is archived.`;
    else if (reason.length > MAX_REASON) problem = t`A reason can have at most 200 characters.`;
    if (problem) {
      setError('reason', { type: 'manual', message: problem });
      show([{ name: 'reason', label, message: problem }]);
      return;
    }
    try {
      await archive.mutateAsync({
        patientId: patient.id,
        tenantId: clinic.tenantId,
        version: patient.version,
        reason,
      });
      onArchived();
    } catch (error) {
      const apiError = asApiError(error);
      if (STALE_CODES.includes(apiError.code)) {
        onStale(apiError);
      } else if (apiError.code === 'VALIDATION_FAILED') {
        show(applyApiErrors({ error: apiError, setError, fieldLabels: { reason: label } }).summary);
      } else {
        setFailure(apiError);
      }
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t`Archive ${name}?`}
      description={t`They are hidden from the patient list and from search. Patients are never deleted, and you can restore them.`}
      dirty={formState.isDirty && !archive.isPending}
      footer={
        <>
          <Button ref={focusFirst} variant="secondary" onClick={onClose}>
            {t`Cancel`}
          </Button>
          <Button
            variant="danger"
            type="submit"
            form={FORM_ID}
            loading={archive.isPending}
            loadingText={t`Archiving…`}
          >
            {t`Archive patient`}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <FormErrorSummary errors={summary} focusKey={attempt} />
        {failure && <SaveFailure error={failure} openedIn={clinic} />}
        <TextField
          label={label}
          autoComplete="off"
          hint={t`For staff only, for example Duplicate record`}
          error={formState.errors.reason?.message}
          {...register('reason')}
        />
      </form>
    </Dialog>
  );
}
