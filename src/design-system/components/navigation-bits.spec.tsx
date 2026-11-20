import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { Button } from './button.tsx';
import { Stepper } from './stepper.tsx';
import { Tabs } from './tabs.tsx';
import { Tooltip } from './tooltip.tsx';

describe('Tabs (sibling views only)', () => {
  function Harness() {
    const [value, setValue] = useState('day');
    return (
      <Tabs
        label="Schedule view"
        value={value}
        onValueChange={setValue}
        tabs={[
          { value: 'day', label: 'Day', content: <p>Day view</p> },
          { value: 'week', label: 'Week', content: <p>Week view</p> },
        ]}
      />
    );
  }

  it('is a tablist with the selected tab and its panel', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Schedule view' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Day' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Day view');
  });

  it('switches with a click and with the arrow keys', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('tab', { name: 'Week' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Week view');
    screen.getByRole('tab', { name: 'Week' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Day' })).toHaveFocus();
  });

  it('has tabs at least 44 px high', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'Day' }).className).toContain('min-h-target');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Harness />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Stepper', () => {
  it('says where you are in words: "Step 2 of 3: Contact details"', () => {
    renderWithProviders(<Stepper steps={['Basics', 'Contact details', 'Review']} current={1} />);
    expect(screen.getByText('Step 2 of 3: Contact details')).toBeInTheDocument();
  });

  it('marks the current step for assistive technology, and lists the others with a state in words', () => {
    renderWithProviders(<Stepper steps={['Basics', 'Contact details', 'Review']} current={1} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).toHaveTextContent('Done');
    expect(items[2]).toHaveTextContent('Not yet');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<Stepper steps={['A', 'B', 'C']} current={0} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Tooltip (extra information only)', () => {
  it('appears on keyboard focus, is linked to the trigger, and goes with Escape', async () => {
    render(
      <Tooltip content="Opens the patient record in a new tab" delayDuration={0}>
        <Button>Open record</Button>
      </Tooltip>,
    );
    await userEvent.tab();
    const tip = await screen.findByRole('tooltip');
    expect(tip).toHaveTextContent('Opens the patient record in a new tab');
    expect(screen.getByRole('button', { name: 'Open record' })).toHaveAccessibleDescription(
      'Opens the patient record in a new tab',
    );
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    render(
      <Tooltip content="More detail" delayDuration={0}>
        <Button>Info</Button>
      </Tooltip>,
    );
    await userEvent.tab();
    await screen.findByRole('tooltip');
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
