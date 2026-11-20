import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/design-system/components/button.tsx';
import { TextField } from '@/design-system/components/text-fields.tsx';
import { ApiError } from '@/api/errors.ts';
import { applyApiErrors } from '@/lib/api-form-errors.ts';

import { FormErrorSummary, type SummaryEntry } from './form-error-summary.tsx';
import { ActionWithReason, NoAccess, PermissionNote, ReadOnlyField } from './permission.tsx';
import { PrintPage } from './print-page.tsx';

const meta: Meta = { title: 'Patterns/Forms, permissions and print' };
export default meta;
type Story = StoryObj;

interface Values {
  name: string;
  address: { city: string };
}
const SERVER_ERROR = new ApiError({
  status: 400,
  code: 'VALIDATION_FAILED',
  message: 'Some fields need attention.',
  requestId: 'req-1',
  details: [
    { field: 'name', code: 'REQUIRED', message: '' },
    { field: 'address.city', code: 'TOO_LONG', message: '' },
  ],
});

export const ServerErrorsOnAForm: Story = {
  render: function Render() {
    const { register, handleSubmit, setError, formState } = useForm<Values>({
      defaultValues: { name: '', address: { city: 'Quezon City' } },
    });
    const [summary, setSummary] = useState<SummaryEntry[]>([]);
    const [attempt, setAttempt] = useState(0);
    return (
      <form
        className="flex max-w-lg flex-col gap-6"
        onSubmit={(event) => {
          void handleSubmit(() => {
            setSummary(
              applyApiErrors<Values>({
                error: SERVER_ERROR,
                setError,
                fieldLabels: { name: 'Branch name', 'address.city': 'City' },
              }).summary,
            );
            setAttempt((n) => n + 1);
          })(event);
        }}
      >
        <p>Press Save: the server answers with two field errors. Nothing you typed is erased.</p>
        <FormErrorSummary errors={summary} focusKey={attempt} />
        <TextField
          label="Branch name"
          autoComplete="off"
          {...register('name')}
          error={formState.errors.name?.message}
        />
        <TextField
          label="City"
          autoComplete="off"
          {...register('address.city')}
          error={formState.errors.address?.city?.message}
        />
        <div>
          <Button type="submit">Save branch</Button>
        </div>
      </form>
    );
  },
};
export const ReadOnlyForViewers: Story = {
  render: () => (
    <div className="flex max-w-lg flex-col gap-4">
      <PermissionNote>Only clinic admins can change these details.</PermissionNote>
      <dl className="flex flex-col gap-3">
        <ReadOnlyField label="Clinic name" value="Sunrise Clinic" />
        <ReadOnlyField label="Phone" value="" />
      </dl>
    </div>
  ),
};
export const NoAccessPage: Story = { render: () => <NoAccess /> };
export const TemporarilyUnavailable: Story = {
  render: () => (
    <ActionWithReason reason="Please wait 2 minutes before trying again.">Sign in</ActionWithReason>
  ),
};
export const PrintTemplate: Story = {
  render: () => (
    <PrintPage
      paper="a4"
      header={<p className="text-h3 font-bold">Sunrise Clinic</p>}
      footer={<p>Template: not an official receipt.</p>}
    >
      <p>Payment summary: ₱1,250.50</p>
    </PrintPage>
  ),
};
