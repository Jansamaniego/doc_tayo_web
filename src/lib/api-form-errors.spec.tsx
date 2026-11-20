import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { ApiError } from '@/api/errors.ts';
import { TextField } from '@/design-system/components/text-fields.tsx';
import {
  FormErrorSummary,
  type SummaryEntry,
} from '@/design-system/patterns/form-error-summary.tsx';
import { renderWithProviders } from '@/test/render.tsx';

import { applyApiErrors } from './api-form-errors.ts';

interface Values {
  name: string;
  address: { city: string };
}

const LABELS = { name: 'Branch name', 'address.city': 'City' };

function validationError(details: { field: string; code: string }[]): ApiError {
  return new ApiError({
    status: 400,
    code: 'VALIDATION_FAILED',
    message: 'Some fields need attention.',
    details: details.map((detail) => ({
      ...detail,
      message: 'server text',
    })) as ApiError['details'],
    requestId: 'req-1',
  });
}

function BranchForm({ fail }: { fail: ApiError }) {
  const { register, handleSubmit, setError, formState } = useForm<Values>({
    defaultValues: { name: 'Main', address: { city: '' } },
  });
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [formMessage, setFormMessage] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(() => {
          const result = applyApiErrors<Values>({ error: fail, setError, fieldLabels: LABELS });
          setSummary(result.summary);
          setFormMessage(result.formMessage);
          setAttempt((count) => count + 1);
        })(event);
      }}
    >
      <FormErrorSummary errors={summary} focusKey={attempt} />
      {formMessage && <p role="alert">{formMessage}</p>}
      <TextField label="Branch name" {...register('name')} error={formState.errors.name?.message} />
      <TextField
        label="City"
        {...register('address.city')}
        error={formState.errors.address?.city?.message}
      />
      <button type="submit">Save branch</button>
    </form>
  );
}

describe('applyApiErrors (server VALIDATION_FAILED into the form)', () => {
  it('puts each message under its own field, using the dotted path, in plain words', async () => {
    renderWithProviders(
      <BranchForm
        fail={validationError([
          { field: 'name', code: 'REQUIRED' },
          { field: 'address.city', code: 'TOO_LONG' },
        ])}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save branch' }));
    expect(screen.getByLabelText('Branch name')).toHaveAccessibleDescription(
      'Please fill in this field.',
    );
    expect(screen.getByLabelText('City')).toHaveAccessibleDescription('This is too long.');
  });

  it('never erases what was typed', async () => {
    renderWithProviders(
      <BranchForm fail={validationError([{ field: 'address.city', code: 'REQUIRED' }])} />,
    );
    await userEvent.type(screen.getByLabelText('City'), 'Quezon');
    await userEvent.click(screen.getByRole('button', { name: 'Save branch' }));
    expect(screen.getByLabelText('City')).toHaveValue('Quezon');
    expect(screen.getByLabelText('Branch name')).toHaveValue('Main');
  });

  it('shows a summary with a link per problem and moves focus to it', async () => {
    renderWithProviders(
      <BranchForm
        fail={validationError([
          { field: 'name', code: 'REQUIRED' },
          { field: 'address.city', code: 'TOO_LONG' },
        ])}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save branch' }));
    expect(screen.getByText('2 things need fixing')).toBeInTheDocument();
    expect(screen.getAllByRole('alert')[0]).toHaveFocus();
    expect(screen.getByRole('link', { name: 'City' })).toBeInTheDocument();
  });

  it('a field the form does not have goes to the summary only, never lost', async () => {
    renderWithProviders(
      <BranchForm fail={validationError([{ field: 'mystery', code: 'INVALID_VALUE' }])} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save branch' }));
    expect(screen.getByText('1 thing needs fixing')).toBeInTheDocument();
    expect(screen.getByText('This value is not allowed.')).toBeInTheDocument();
  });

  it('translates every field code through the catalogue (never shows the code)', async () => {
    renderWithProviders(
      <BranchForm fail={validationError([{ field: 'name', code: 'PASSWORD_TOO_COMMON' }])} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save branch' }));
    // Once under the field and once in the summary.
    expect(
      screen.getAllByText('This password is too easy to guess. Please choose another.'),
    ).toHaveLength(2);
    expect(screen.queryByText(/PASSWORD_TOO_COMMON/)).not.toBeInTheDocument();
  });

  it('uses the server text only for a code this client does not know', async () => {
    renderWithProviders(
      <BranchForm fail={validationError([{ field: 'name', code: 'BRAND_NEW' }])} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save branch' }));
    expect(screen.getByLabelText('Branch name')).toHaveAccessibleDescription('server text');
  });

  it('turns any other API error into one plain message for the form, with no field errors', async () => {
    const rateLimited = new ApiError({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'x',
      details: [],
      requestId: 'r',
      retryAfterSeconds: 30,
    });
    renderWithProviders(<BranchForm fail={rateLimited} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save branch' }));
    expect(
      screen.getByText('Too many attempts. Please wait a moment and try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/need fixing/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Branch name')).not.toHaveAttribute('aria-invalid');
  });
});
