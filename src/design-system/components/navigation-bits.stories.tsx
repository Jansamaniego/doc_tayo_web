import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from './button.tsx';
import { Stepper } from './stepper.tsx';
import { Tabs } from './tabs.tsx';
import { Tooltip } from './tooltip.tsx';

const meta: Meta = { title: 'Components/Tabs, stepper and tooltip' };
export default meta;
type Story = StoryObj;

export const DayWeekTabs: Story = {
  render: function Render() {
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
  },
};
export const MultiStep: Story = {
  render: () => <Stepper steps={['Basics', 'Contact details', 'Review']} current={1} />,
};
export const ExtraInformationTooltip: Story = {
  render: () => (
    <div className="p-8">
      <Tooltip content="Opens the patient record in a new tab">
        <Button variant="secondary">Open record</Button>
      </Tooltip>
    </div>
  ),
};
