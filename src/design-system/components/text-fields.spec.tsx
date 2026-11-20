import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { MoneyField, PasswordField, SearchField, TextArea, TextField } from './text-fields.tsx';

describe('TextField', () => {
  it('has a visible label, passes autocomplete through, and keeps what was typed', async () => {
    renderWithProviders(
      <TextField label="Email" autoComplete="email" error="Enter an email address." />,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('autocomplete', 'email');
    await userEvent.type(input, 'ana@');
    expect(input).toHaveValue('ana@');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not accept a placeholder (examples go in the hint)', () => {
    // @ts-expect-error placeholders are not part of the design system
    renderWithProviders(<TextField label="Phone" placeholder="0917" />);
  });

  it('is at least 48 px high', () => {
    renderWithProviders(<TextField label="Name" />);
    expect(screen.getByLabelText('Name').className).toContain('min-h-control-md');
  });

  it('read-only shows the value without an editable look', () => {
    renderWithProviders(<TextField label="Clinic" readOnly defaultValue="Sunrise Clinic" />);
    const input = screen.getByLabelText('Clinic');
    expect(input).toHaveAttribute('readonly');
    expect(input.className).not.toContain('border-control');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <>
        <TextField label="Name" />
        <TextField label="Email" hint="We never share it." error="Enter an email." />
        <TextField label="Clinic" readOnly defaultValue="Sunrise" />
        <TextField label="Nickname" optional disabled />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('TextArea', () => {
  it('counts characters when there is a limit, in words', async () => {
    renderWithProviders(<TextArea label="Notes" maxLength={500} />);
    expect(screen.getByText('0 of 500 characters')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Notes'), 'hello');
    expect(screen.getByText('5 of 500 characters')).toBeInTheDocument();
  });

  it('shows no counter without a limit', () => {
    renderWithProviders(<TextArea label="Notes" />);
    expect(screen.queryByText(/characters/)).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <TextArea label="Notes" maxLength={200} error="Too long." />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('PasswordField', () => {
  it('hides the password and has a "Show password" button with words', async () => {
    renderWithProviders(<PasswordField label="Password" autoComplete="new-password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('keeps the typed value when toggling', async () => {
    renderWithProviders(<PasswordField label="Password" />);
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveValue('correct horse');
  });

  it('lists the rules, each with a state in words (not colour alone)', () => {
    renderWithProviders(
      <PasswordField
        label="New password"
        rules={[
          { text: 'At least 10 characters', met: true },
          { text: 'Not a very common password', met: false },
        ]}
      />,
    );
    expect(screen.getByText('At least 10 characters')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Not yet')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <PasswordField
        label="New password"
        error="This password is too easy to guess."
        rules={[{ text: 'At least 10 characters', met: false }]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('MoneyField', () => {
  function Harness({ initial = null }: { initial?: number | null }) {
    const [value, setValue] = useState<number | null>(initial);
    return (
      <>
        <MoneyField label="Amount" value={value} onChange={setValue} />
        <output data-testid="out">{value === null ? 'none' : String(value)}</output>
      </>
    );
  }

  it('shows a peso sign and a decimal keyboard', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByText('₱')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toHaveAttribute('inputmode', 'decimal');
  });

  it('reports whole centavos as you type, without rewriting what you typed', async () => {
    renderWithProviders(<Harness />);
    const input = screen.getByLabelText('Amount');
    await userEvent.type(input, '1250.5');
    expect(input).toHaveValue('1250.5');
    expect(screen.getByTestId('out')).toHaveTextContent('125050');
  });

  it('formats with separators and two decimals only when you leave the field', async () => {
    renderWithProviders(<Harness />);
    const input = screen.getByLabelText('Amount');
    await userEvent.type(input, '1250.5');
    await userEvent.tab();
    expect(input).toHaveValue('1,250.50');
  });

  it('accepts commas typed by the person', async () => {
    renderWithProviders(<Harness />);
    await userEvent.type(screen.getByLabelText('Amount'), '1,250');
    expect(screen.getByTestId('out')).toHaveTextContent('125000');
  });

  it.each(['12abc', '1.234', '-5', '1.2.3'])(
    'treats "%s" as invalid, says so in words, and keeps the text',
    async (text) => {
      renderWithProviders(<Harness />);
      const input = screen.getByLabelText('Amount');
      await userEvent.type(input, text);
      expect(input).toHaveValue(text);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('Enter an amount, for example 1,250.50.')).toBeInTheDocument();
      expect(screen.getByTestId('out')).toHaveTextContent('none');
    },
  );

  it('starts from an existing value', () => {
    renderWithProviders(<Harness initial={5} />);
    expect(screen.getByLabelText('Amount')).toHaveValue('0.05');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<Harness initial={125050} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('SearchField', () => {
  it('has a visible label and a search role', () => {
    renderWithProviders(
      <SearchField
        label="Search patients"
        value=""
        onChange={() => undefined}
        onSearch={() => undefined}
      />,
    );
    expect(screen.getByRole('searchbox', { name: 'Search patients' })).toBeInTheDocument();
  });

  it('searches 300 ms after you stop typing, and at once on Enter', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onSearch = vi.fn();
    function Harness() {
      const [value, setValue] = useState('');
      return <SearchField label="Search" value={value} onChange={setValue} onSearch={onSearch} />;
    }
    renderWithProviders(<Harness />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByRole('searchbox'), 'dela');
    expect(onSearch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenLastCalledWith('dela');
    await user.type(screen.getByRole('searchbox'), ' cruz{Enter}');
    expect(onSearch).toHaveBeenLastCalledWith('dela cruz');
    vi.useRealTimers();
  });

  it('has a Clear button with words that appears only when there is text', async () => {
    function Harness() {
      const [value, setValue] = useState('abc');
      return (
        <SearchField label="Search" value={value} onChange={setValue} onSearch={() => undefined} />
      );
    }
    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('announces the result summary politely', () => {
    renderWithProviders(
      <SearchField
        label="Search"
        value="a"
        onChange={() => undefined}
        onSearch={() => undefined}
        resultSummary="12 patients found"
      />,
    );
    const live = screen.getByText('12 patients found');
    expect(live.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <SearchField
        label="Search patients"
        value="ana"
        onChange={() => undefined}
        onSearch={() => undefined}
        resultSummary="3 found"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
