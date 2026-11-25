import { useLingui } from '@lingui/react/macro';
import type { ComponentProps } from 'react';
import { useWatch } from 'react-hook-form';

import { RadioGroup } from '@/design-system/components/choice-fields.tsx';
import { DateField } from '@/design-system/components/date-fields.tsx';
import { TextArea, TextField } from '@/design-system/components/text-fields.tsx';

import type { PatientValues } from './patient-form-values.ts';
import { EARLIEST_BIRTH_DATE, type PatientFormModel } from './use-patient-form.ts';

const SECTION = 'flex flex-col gap-6 rounded-lg border border-divider bg-surface p-6 shadow-1';

/** Every field of a patient, in the same order for registering and editing. */
export function PatientFields({ model }: { model: PatientFormModel }) {
  const { t } = useLingui();
  const { labels, today, revision, birthIncompleteRef } = model;
  const { register, control, setValue, clearErrors } = model.form;
  const { errors } = model.form.formState;
  const [sex, birthDate] = useWatch({ control, name: ['sex', 'birthDate'] });

  const text = (
    name: Exclude<keyof PatientValues, 'sex' | 'birthDate'>,
    extra: Partial<ComponentProps<typeof TextField>> = {},
  ) => (
    <TextField
      label={labels[name]}
      autoComplete="off"
      error={errors[name]?.message}
      {...extra}
      {...register(name)}
    />
  );

  return (
    <>
      <div className={SECTION}>
        {text('firstName')}
        {text('middleName', { optional: true })}
        {text('lastName')}
        {text('suffix', { optional: true, hint: t`Jr., Sr., III` })}
        <RadioGroup
          legend={labels.sex}
          error={errors.sex?.message}
          options={[
            { value: 'female', label: t`Female` },
            { value: 'male', label: t`Male` },
            { value: 'unknown', label: t`Not recorded` },
          ]}
          value={sex}
          onChange={(value) => {
            setValue('sex', value as PatientValues['sex'], { shouldDirty: true });
          }}
        />
        <DateField
          key={revision}
          legend={labels.birthDate}
          optional
          value={birthDate}
          min={EARLIEST_BIRTH_DATE}
          max={today}
          error={errors.birthDate?.message}
          onChange={(value) => {
            clearErrors('birthDate');
            setValue('birthDate', value, { shouldDirty: true });
          }}
          onIncompleteChange={(incomplete) => {
            birthIncompleteRef.current = incomplete;
          }}
        />
      </div>
      <div className={SECTION}>
        {text('phone', { optional: true, type: 'tel', hint: t`For example 0917 123 4567` })}
        {text('email', { optional: true, type: 'email' })}
        {text('addressLine', { optional: true })}
        {text('city', { optional: true })}
        {text('province', { optional: true })}
      </div>
      <div className={SECTION}>
        {text('guardianName', { optional: true })}
        {text('guardianPhone', { optional: true, type: 'tel' })}
      </div>
      <div className={SECTION}>
        <TextArea
          label={labels.allergies}
          optional
          error={errors.allergies?.message}
          {...register('allergies')}
        />
        <TextArea
          label={labels.notes}
          optional
          error={errors.notes?.message}
          {...register('notes')}
        />
      </div>
    </>
  );
}
