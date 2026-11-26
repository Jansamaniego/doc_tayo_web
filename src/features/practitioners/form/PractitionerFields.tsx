import { useLingui } from '@lingui/react/macro';

import { TextField } from '@/design-system/components/text-fields.tsx';

import type { PractitionerFormModel } from './use-practitioner-form.ts';

/** The profile fields, the same for adding and editing. */
export function PractitionerFields({ model }: { model: PractitionerFormModel }) {
  const { t } = useLingui();
  const { labels } = model;
  const { register } = model.form;
  const { errors } = model.form.formState;
  return (
    <>
      <TextField
        label={labels.displayName}
        autoComplete="off"
        hint={t`How it is printed, for example Dra. Ana Cruz, MD`}
        error={errors.displayName?.message}
        {...register('displayName')}
      />
      <TextField
        label={labels.specialization}
        optional
        autoComplete="off"
        error={errors.specialization?.message}
        {...register('specialization')}
      />
      <TextField
        label={labels.prcLicenseNumber}
        optional
        autoComplete="off"
        error={errors.prcLicenseNumber?.message}
        {...register('prcLicenseNumber')}
      />
      <TextField
        label={labels.ptrNumber}
        optional
        autoComplete="off"
        error={errors.ptrNumber?.message}
        {...register('ptrNumber')}
      />
    </>
  );
}
