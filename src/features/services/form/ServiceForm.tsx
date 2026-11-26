import { useLingui } from '@lingui/react/macro';
import { useRef, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { asApiError, type ApiError } from '@/api/errors.ts';
import { sessionStore } from '@/api/session/session-store.ts';
import { Button } from '@/design-system/components/button.tsx';
import { RadioGroup } from '@/design-system/components/choice-fields.tsx';
import { MoneyField, TextArea, TextField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { applyApiErrors } from '@/lib/api-form-errors.ts';
import { LeaveGuard } from '@/lib/leave-guard.tsx';
import { SaveFailure, type OpenedClinic } from '@/lib/opened-clinic.tsx';

import type { Service } from '../api/services.ts';
import { checkService, type PriceKind, type ServiceValues } from './service-form-values.ts';

/** `nothing-to-change` is for an edit where every field is as it was. */
export type ServiceSubmitResult = Service | 'nothing-to-change';

/**
 * The service fields, for adding and editing. It checks what it can, then hands the values to
 * `onSubmit`, which sends them and may throw the API's error: a field problem or a name already taken
 * is shown under its field, anything else above the buttons.
 */
export function ServiceForm({
  initial,
  openedIn,
  submitLabel,
  cancel,
  onSubmit,
  onSaved,
  onMissing,
}: {
  initial: ServiceValues;
  /** The clinic the form was opened in, which a failed save names. */
  openedIn: OpenedClinic;
  submitLabel: string;
  cancel: ReactNode;
  onSubmit: (values: ServiceValues) => Promise<ServiceSubmitResult>;
  onSaved: (service: Service) => void;
  /** The service being edited is gone (404). */
  onMissing?: () => void;
}) {
  const { t } = useLingui();
  const form = useForm<ServiceValues>({ defaultValues: initial });
  const { register, setValue, setError, clearErrors, handleSubmit, control } = form;
  const { errors, isDirty, isSubmitting } = form.formState;
  const priceKind = useWatch({ control, name: 'priceKind' });
  const price = useWatch({ control, name: 'price' });
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<ApiError | undefined>();
  const [nothingToChange, setNothingToChange] = useState(false);
  const saved = useRef(false);

  const labels = {
    name: t`Service name`,
    description: t`Description`,
    defaultDurationMinutes: t`Usual length, in minutes`,
    price: t`Amount`,
  };

  function show(problems: SummaryEntry[]): void {
    for (const problem of problems) {
      setError(problem.name as keyof ServiceValues, { type: 'manual', message: problem.message });
    }
    setSummary(problems);
    setAttempt((count) => count + 1);
  }

  function refused(error: ApiError): void {
    if (error.code === 'VALIDATION_FAILED') {
      setSummary(applyApiErrors({ error, setError, fieldLabels: labels }).summary);
      setAttempt((count) => count + 1);
    } else if (error.code === 'CONFLICT_UNIQUE') {
      show([
        {
          name: 'name',
          label: labels.name,
          message: t`This clinic already has a service with this name.`,
        },
      ]);
    } else if (error.code === 'NOT_FOUND' && onMissing) {
      onMissing();
    } else {
      setFailure(error);
    }
  }

  async function send(values: ServiceValues): Promise<void> {
    clearErrors();
    setSummary([]);
    setFailure(undefined);
    setNothingToChange(false);
    const problems = checkService(values);
    if (problems.length > 0) {
      show(problems.map((problem) => ({ ...problem, label: labels[problem.name] })));
      return;
    }
    try {
      const result = await onSubmit(values);
      if (result === 'nothing-to-change') {
        setNothingToChange(true);
        return;
      }
      saved.current = true;
      onSaved(result);
    } catch (error) {
      refused(asApiError(error));
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(send)(event);
      }}
    >
      <FormErrorSummary errors={summary} focusKey={attempt} />
      <TextField
        label={labels.name}
        autoComplete="off"
        hint={t`For example Follow-up or Wound dressing`}
        error={errors.name?.message}
        {...register('name')}
      />
      <TextArea
        label={labels.description}
        optional
        error={errors.description?.message}
        {...register('description')}
      />
      <TextField
        label={labels.defaultDurationMinutes}
        inputMode="numeric"
        autoComplete="off"
        hint={t`5 to 480 minutes. A suggestion for the appointment length; it can be changed when booking.`}
        error={errors.defaultDurationMinutes?.message}
        {...register('defaultDurationMinutes')}
      />
      <div className="flex flex-col gap-4">
        <RadioGroup
          legend={t`Price`}
          // Fixed price is last, so its amount appears directly under it.
          options={[
            { value: 'none', label: t`No fixed price` },
            { value: 'free', label: t`Free` },
            { value: 'fixed', label: t`Fixed price` },
          ]}
          value={priceKind}
          onChange={(value) => {
            setValue('priceKind', value as PriceKind, { shouldDirty: true });
            clearErrors('price');
          }}
        />
        {priceKind === 'fixed' && (
          <MoneyField
            name="price"
            label={labels.price}
            error={errors.price?.message}
            value={price}
            onChange={(centavos) => {
              setValue('price', centavos, { shouldDirty: true });
              clearErrors('price');
            }}
          />
        )}
      </div>
      {failure && <SaveFailure error={failure} openedIn={openedIn} />}
      {nothingToChange && <p role="status">{t`Nothing to change.`}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" loading={isSubmitting} loadingText={t`Saving…`}>
          {submitLabel}
        </Button>
        {cancel}
      </div>
      <LeaveGuard
        shouldBlock={() =>
          !saved.current &&
          // A session that ended must always reach the sign-in page.
          sessionStore.get().status === 'signed-in' &&
          isDirty
        }
      />
    </form>
  );
}
