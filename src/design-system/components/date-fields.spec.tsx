import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { DateField, DatePicker, DateRangePicker, TimeField } from './date-fields.tsx';

function DateHarness({
  initial = '',
  min,
  max,
  onChange = () => undefined,
  error,
}: {
  initial?: string;
  min?: string;
  max?: string;
  onChange?: (v: string) => void;
  error?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DateField
      legend="Date of birth"
      value={value}
      min={min}
      max={max}
      error={error}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('DateField', () => {
  it('is a group with a legend and three labelled parts, month by name', () => {
    renderWithProviders(<DateHarness />);
    const group = screen.getByRole('group', { name: 'Date of birth' });
    expect(within(group).getByLabelText('Month').tagName).toBe('SELECT');
    expect(within(group).getByLabelText('Day')).toBeInTheDocument();
    expect(within(group).getByLabelText('Year')).toBeInTheDocument();
    const months = within(within(group).getByLabelText('Month')).getAllByRole('option');
    expect(months.map((option) => option.textContent)).toContain('November');
    expect(months).toHaveLength(13); // 12 months and an empty first choice
  });

  it('shows the parts of an existing value', () => {
    renderWithProviders(<DateHarness initial="1980-03-08" />);
    expect(screen.getByLabelText('Month')).toHaveValue('3');
    expect(screen.getByLabelText('Day')).toHaveValue('8');
    expect(screen.getByLabelText('Year')).toHaveValue('1980');
  });

  it('reports a full date as YYYY-MM-DD once all three parts are filled, and "" before', async () => {
    const onChange = vi.fn();
    renderWithProviders(<DateHarness onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Month'), 'November');
    expect(onChange).toHaveBeenLastCalledWith('');
    await userEvent.type(screen.getByLabelText('Day'), '21');
    await userEvent.type(screen.getByLabelText('Year'), '2026');
    expect(onChange).toHaveBeenLastCalledWith('2026-11-21');
  });

  it('never erases what was typed, even while incomplete or invalid', async () => {
    renderWithProviders(<DateHarness />);
    await userEvent.type(screen.getByLabelText('Day'), '31');
    await userEvent.selectOptions(screen.getByLabelText('Month'), 'February');
    await userEvent.type(screen.getByLabelText('Year'), '2026');
    expect(screen.getByLabelText('Day')).toHaveValue('31');
    expect(screen.getByLabelText('Year')).toHaveValue('2026');
  });

  it('says in words when the date does not exist', async () => {
    const onChange = vi.fn();
    renderWithProviders(<DateHarness onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Day'), '30');
    await userEvent.selectOptions(screen.getByLabelText('Month'), 'February');
    await userEvent.type(screen.getByLabelText('Year'), '2026');
    expect(screen.getByText('That date does not exist.')).toBeInTheDocument();
    // aria-invalid is not valid on a group: the parts themselves are marked.
    expect(screen.getByLabelText('Day')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Day')).toHaveAccessibleDescription('That date does not exist.');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('enforces a minimum, in words', () => {
    renderWithProviders(<DateHarness initial="2020-01-01" min="2025-01-01" max="2026-12-31" />);
    expect(screen.getByText('Choose a date on or after Jan 1, 2025.')).toBeInTheDocument();
  });

  it('enforces the maximum too', () => {
    renderWithProviders(<DateHarness initial="2030-01-01" min="2025-01-01" max="2026-12-31" />);
    expect(screen.getByText('Choose a date on or before Dec 31, 2026.')).toBeInTheDocument();
  });

  it('shows an error from the form under the group', () => {
    renderWithProviders(<DateHarness error="Enter the date of birth." />);
    expect(screen.getByText('Enter the date of birth.')).toBeInTheDocument();
  });

  it('is reached with Tab in reading order: month, day, year', async () => {
    renderWithProviders(<DateHarness />);
    await userEvent.tab();
    expect(screen.getByLabelText('Month')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('Day')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('Year')).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <>
        <DateHarness />
        <DateHarness initial="2026-02-30" error="Check the date." />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DatePicker', () => {
  function Harness({ initial = '2026-11-20' }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return <DatePicker legend="Appointment date" value={value} onChange={setValue} />;
  }

  it('is the typed field plus an optional button to choose on a calendar', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByLabelText('Day')).toHaveValue('20');
    const button = screen.getByRole('button', { name: 'Choose on calendar' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('opens a calendar on the month of the value and picks a day', async () => {
    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Choose on calendar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose a date' });
    expect(within(dialog).getByText(/November 2026/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: /November 25(th)?, 2026/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Day')).toHaveValue('25');
    expect(screen.getByLabelText('Month')).toHaveValue('11');
  });

  it('keeps the same calendar day for dates around a daylight-saving change (no time zone shift)', async () => {
    renderWithProviders(<Harness initial="2026-03-08" />);
    await userEvent.click(screen.getByRole('button', { name: 'Choose on calendar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose a date' });
    await userEvent.click(within(dialog).getByRole('button', { name: /March 9(th)?, 2026/ }));
    expect(screen.getByLabelText('Day')).toHaveValue('9');
  });

  it('closes with Escape and gives focus back to the button', async () => {
    renderWithProviders(<Harness />);
    const button = screen.getByRole('button', { name: 'Choose on calendar' });
    await userEvent.click(button);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('has no accessibility violations, closed and open', async () => {
    const { container } = renderWithProviders(<Harness />);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Choose on calendar' }));
    await screen.findByRole('dialog');
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});

describe('TimeField', () => {
  function Harness({
    initial = '',
    onChange = () => undefined,
    minuteStep,
  }: {
    initial?: string;
    onChange?: (v: string) => void;
    minuteStep?: number;
  }) {
    const [value, setValue] = useState(initial);
    return (
      <TimeField
        legend="Start time"
        value={value}
        minuteStep={minuteStep}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }

  it('is a group with labelled hour, minute and AM/PM, on a 12-hour clock', () => {
    renderWithProviders(<Harness />);
    const group = screen.getByRole('group', { name: 'Start time' });
    expect(within(group).getByLabelText('Hour')).toBeInTheDocument();
    expect(within(group).getByLabelText('Minute')).toBeInTheDocument();
    expect(within(group).getByLabelText('AM or PM')).toBeInTheDocument();
    expect(within(within(group).getByLabelText('Hour')).getAllByRole('option')).toHaveLength(13);
  });

  it('shows an existing 24-hour value on the 12-hour clock', () => {
    renderWithProviders(<Harness initial="14:30" />);
    expect(screen.getByLabelText('Hour')).toHaveValue('2');
    expect(screen.getByLabelText('Minute')).toHaveValue('30');
    expect(screen.getByLabelText('AM or PM')).toHaveValue('PM');
  });

  it.each([
    ['12', '00', 'AM', '00:00'],
    ['12', '30', 'PM', '12:30'],
    ['1', '05', 'AM', '01:05'],
    ['11', '55', 'PM', '23:55'],
  ])('turns %s:%s %s into %s', async (hour, minute, period, expected) => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Hour'), hour);
    await userEvent.selectOptions(screen.getByLabelText('Minute'), minute);
    await userEvent.selectOptions(screen.getByLabelText('AM or PM'), period);
    expect(onChange).toHaveBeenLastCalledWith(expected);
  });

  it('reports "" until every part is chosen, and keeps the choices', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Hour'), '3');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.getByLabelText('Hour')).toHaveValue('3');
  });

  it('offers minutes in steps, but never drops a minute that is already set', () => {
    renderWithProviders(<Harness initial="09:07" minuteStep={15} />);
    const minutes = within(screen.getByLabelText('Minute'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(minutes).toContain('00');
    expect(minutes).toContain('15');
    expect(minutes).toContain('07');
    expect(minutes).not.toContain('05');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<Harness initial="14:30" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DateRangePicker', () => {
  function Harness({
    initial = { from: '2026-11-01', to: '2026-11-30' },
  }: {
    initial?: { from: string; to: string };
  }) {
    const [range, setRange] = useState(initial);
    return <DateRangePicker legend="Report period" value={range} onChange={setRange} />;
  }

  it('has a legend and a From and a To date', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByRole('group', { name: 'Report period' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'From' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'To' })).toBeInTheDocument();
  });

  it('says in words when the end is before the start', () => {
    renderWithProviders(<Harness initial={{ from: '2026-11-30', to: '2026-11-01' }} />);
    expect(
      screen.getByText('The end date must be on or after the start date.'),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<Harness />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('DateField: telling the form about a date that is typed but not usable', () => {
  const setup = (initial = '') => {
    const onIncompleteChange = vi.fn();
    renderWithProviders(
      <DateField
        legend="Date of birth"
        value={initial}
        onChange={() => undefined}
        onIncompleteChange={onIncompleteChange}
      />,
    );
    return onIncompleteChange;
  };
  const month = () => screen.getByLabelText('Month');
  const day = () => screen.getByLabelText('Day');
  const year = () => screen.getByLabelText('Year');

  it('is incomplete while only some parts are filled, and no longer once a real date is there', async () => {
    const incomplete = setup();
    await userEvent.selectOptions(month(), 'March');
    expect(incomplete).toHaveBeenLastCalledWith(true);
    await userEvent.type(day(), '8');
    await userEvent.type(year(), '1980');
    expect(incomplete).toHaveBeenLastCalledWith(false);
  });

  it('is incomplete for a date that does not exist', async () => {
    const incomplete = setup();
    await userEvent.selectOptions(month(), 'February');
    await userEvent.type(day(), '30');
    await userEvent.type(year(), '2020');
    expect(incomplete).toHaveBeenLastCalledWith(true);
  });

  it('is not incomplete when every part is cleared again', async () => {
    const incomplete = setup();
    await userEvent.type(day(), '8');
    await userEvent.clear(day());
    expect(incomplete).toHaveBeenLastCalledWith(false);
  });
});
