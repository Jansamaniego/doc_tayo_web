import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { Field } from './field.tsx';

function renderField(props: Partial<Parameters<typeof Field>[0]> = {}) {
  return renderWithProviders(
    <Field label="Email" {...props}>
      {(control) => <input type="email" {...control} />}
    </Field>,
  );
}

describe('Field', () => {
  it('shows the label above the control, always, and links them', () => {
    renderField();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByText('Email').tagName).toBe('LABEL');
  });

  it('marks optional fields, not required ones', () => {
    renderField({ optional: true });
    expect(screen.getByText('Optional')).toBeInTheDocument();
    renderField({ label: 'Name' });
    expect(screen.queryAllByText('Optional')).toHaveLength(1);
  });

  it('links the hint to the control', () => {
    renderField({ hint: 'For example: juan@example.com' });
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'For example: juan@example.com',
    );
  });

  it('shows the error under the field with an icon, links it, and marks the control invalid', () => {
    const { container } = renderField({
      hint: 'We never share it.',
      error: 'Enter an email address.',
    });
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/Enter an email address\./);
    expect(input).toHaveAccessibleDescription(/We never share it\./);
    expect(screen.getByText('Enter an email address.')).toBeInTheDocument();
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('is not invalid without an error', () => {
    renderField();
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });

  it('has no accessibility violations (plain, with hint, with error, optional)', async () => {
    const { container } = renderWithProviders(
      <>
        <Field label="One">{(c) => <input {...c} />}</Field>
        <Field label="Two" hint="A hint">
          {(c) => <input {...c} />}
        </Field>
        <Field label="Three" error="Wrong">
          {(c) => <input {...c} />}
        </Field>
        <Field label="Four" optional>
          {(c) => <input {...c} />}
        </Field>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
