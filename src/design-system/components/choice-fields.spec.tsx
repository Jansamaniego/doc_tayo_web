import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { Checkbox, CheckboxGroup, RadioGroup, Switch } from './choice-fields.tsx';

describe('Checkbox', () => {
  it('has a clickable label and toggles with the mouse and the Space key', async () => {
    const onCheckedChange = vi.fn();
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <Checkbox
          label="Send reminders"
          checked={checked}
          onCheckedChange={(next) => {
            setChecked(next === true);
            onCheckedChange(next);
          }}
        />
      );
    }
    renderWithProviders(<Harness />);
    const box = screen.getByRole('checkbox', { name: 'Send reminders' });
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByText('Send reminders'));
    expect(box).toBeChecked();
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    box.focus();
    await userEvent.keyboard(' ');
    expect(box).not.toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it('supports the indeterminate state', () => {
    renderWithProviders(
      <Checkbox label="All branches" checked="indeterminate" onCheckedChange={() => undefined} />,
    );
    expect(screen.getByRole('checkbox', { name: 'All branches' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
  });

  it('has a row of at least 44 px so the whole line is the target', () => {
    renderWithProviders(
      <Checkbox label="Send reminders" checked={false} onCheckedChange={() => undefined} />,
    );
    expect(screen.getByText('Send reminders').closest('label')?.className).toContain(
      'min-h-target',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <>
        <Checkbox label="One" checked={false} onCheckedChange={() => undefined} />
        <Checkbox label="Two" checked onCheckedChange={() => undefined} />
        <Checkbox label="Three" checked="indeterminate" onCheckedChange={() => undefined} />
        <Checkbox label="Four" checked={false} disabled onCheckedChange={() => undefined} />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('CheckboxGroup', () => {
  const options = [
    { value: 'mon', label: 'Monday' },
    { value: 'tue', label: 'Tuesday' },
  ];

  it('groups the boxes under a legend, with hint and error linked to the group', () => {
    renderWithProviders(
      <CheckboxGroup
        legend="Clinic days"
        options={options}
        value={[]}
        onChange={() => undefined}
        hint="Choose all that apply"
        error="Choose at least one day."
      />,
    );
    const group = screen.getByRole('group', { name: 'Clinic days' });
    expect(group).toHaveAccessibleDescription(/Choose all that apply/);
    expect(group).toHaveAccessibleDescription(/Choose at least one day\./);
  });

  it('reports the chosen values', async () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState<string[]>([]);
      return (
        <CheckboxGroup
          legend="Clinic days"
          options={options}
          value={value}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      );
    }
    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tuesday' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Monday' }));
    expect(onChange).toHaveBeenLastCalledWith(['tue', 'mon']);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tuesday' }));
    expect(onChange).toHaveBeenLastCalledWith(['mon']);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <CheckboxGroup
        legend="Clinic days"
        options={options}
        value={['mon']}
        onChange={() => undefined}
        error="Oops"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('RadioGroup', () => {
  const options = [
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'gcash', label: 'GCash' },
  ];

  it('groups the options under a legend and selects with a click', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <RadioGroup legend="Payment" options={options} value="cash" onChange={onChange} />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Payment' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Card' }));
    expect(onChange).toHaveBeenCalledWith('card');
  });

  it('moves with the arrow keys, like any radio group', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <RadioGroup legend="Payment" options={options} value="cash" onChange={onChange} />,
    );
    screen.getByRole('radio', { name: 'Cash' }).focus();
    // Radix selects the radio that receives focus while an arrow key is still held, and moves focus on
    // a timer: hold the key like a person would, then release it.
    await userEvent.keyboard('{ArrowDown>}');
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('card');
    });
    await userEvent.keyboard('{/ArrowDown}');
  });

  it('shows hint and error for the group, and the rows are at least 44 px', () => {
    renderWithProviders(
      <RadioGroup
        legend="Payment"
        options={options}
        value=""
        onChange={() => undefined}
        error="Choose how they paid."
      />,
    );
    expect(screen.getByRole('radiogroup')).toHaveAccessibleDescription(/Choose how they paid\./);
    expect(screen.getByText('Cash').closest('label')?.className).toContain('min-h-target');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <RadioGroup
        legend="Payment"
        options={options}
        value="card"
        onChange={() => undefined}
        hint="Pick one"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Switch', () => {
  it('is a switch with a label, toggled by click and Space, and explains what it does', async () => {
    const onCheckedChange = vi.fn();
    function Harness() {
      const [on, setOn] = useState(false);
      return (
        <Switch
          label="Email reminders"
          description="Takes effect immediately."
          checked={on}
          onCheckedChange={(next) => {
            setOn(next);
            onCheckedChange(next);
          }}
        />
      );
    }
    renderWithProviders(<Harness />);
    const toggle = screen.getByRole('switch', { name: 'Email reminders' });
    expect(toggle).toHaveAccessibleDescription('Takes effect immediately.');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    toggle.focus();
    await userEvent.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it('shows the state in words, not only by position or colour', () => {
    renderWithProviders(
      <Switch label="Email reminders" checked onCheckedChange={() => undefined} />,
    );
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <>
        <Switch label="One" checked={false} onCheckedChange={() => undefined} />
        <Switch label="Two" checked onCheckedChange={() => undefined} description="Applies now." />
        <Switch label="Three" checked={false} disabled onCheckedChange={() => undefined} />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
