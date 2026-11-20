import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { FormErrorSummary } from './form-error-summary.tsx';

const ERRORS = [
  { name: 'name', label: 'Branch name', message: 'Please fill in this field.' },
  { name: 'city', label: 'City', message: 'This is too long.' },
];

describe('FormErrorSummary', () => {
  it('says how many things need fixing, in words', () => {
    renderWithProviders(<FormErrorSummary errors={ERRORS} />);
    expect(screen.getByRole('alert')).toHaveTextContent('2 things need fixing');
  });

  it('uses the singular for one', () => {
    renderWithProviders(<FormErrorSummary errors={ERRORS.slice(0, 1)} />);
    expect(screen.getByRole('alert')).toHaveTextContent('1 thing needs fixing');
  });

  it('lists each problem as a link to its field, with the message in plain words', () => {
    renderWithProviders(<FormErrorSummary errors={ERRORS} />);
    expect(screen.getByRole('link', { name: 'Branch name' })).toBeInTheDocument();
    expect(screen.getByText('Please fill in this field.')).toBeInTheDocument();
  });

  it('moves focus to the summary when it appears, so a screen reader reads it first', () => {
    renderWithProviders(<FormErrorSummary errors={ERRORS} />);
    expect(screen.getByRole('alert')).toHaveFocus();
  });

  it('moves focus again when a new failed submit asks for it', () => {
    const { rerender } = renderWithProviders(<FormErrorSummary errors={ERRORS} focusKey={1} />);
    screen.getByRole('link', { name: 'City' }).focus();
    rerender(<FormErrorSummary errors={ERRORS} focusKey={2} />);
    expect(screen.getByRole('alert')).toHaveFocus();
  });

  it('a link puts the focus in the field (found by name), and does not navigate', async () => {
    renderWithProviders(
      <>
        <FormErrorSummary errors={ERRORS} />
        <input name="name" aria-label="Branch name field" />
        <input name="city" aria-label="City field" />
      </>,
    );
    await userEvent.click(screen.getByRole('link', { name: 'City' }));
    expect(screen.getByLabelText('City field')).toHaveFocus();
    expect(window.location.hash).toBe('');
  });

  it('renders nothing when there are no errors', () => {
    const { container } = renderWithProviders(<FormErrorSummary errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<FormErrorSummary errors={ERRORS} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
