import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Checkbox, CheckboxGroup, RadioGroup, Switch } from './choice-fields.tsx';

const meta: Meta = { title: 'Components/Checkbox, radio and switch' };
export default meta;
type Story = StoryObj;

export const SingleCheckbox: Story = {
  render: function Render() {
    const [checked, setChecked] = useState<boolean | 'indeterminate'>(false);
    return (
      <Checkbox label="Send appointment reminders" checked={checked} onCheckedChange={setChecked} />
    );
  },
};
export const CheckboxStates: Story = {
  render: () => (
    <div className="flex flex-col">
      <Checkbox label="Unchecked" checked={false} onCheckedChange={() => undefined} />
      <Checkbox label="Checked" checked onCheckedChange={() => undefined} />
      <Checkbox label="Some branches" checked="indeterminate" onCheckedChange={() => undefined} />
      <Checkbox label="Disabled" checked={false} disabled onCheckedChange={() => undefined} />
    </div>
  ),
};
export const GroupWithError: Story = {
  render: function Render() {
    const [value, setValue] = useState<string[]>([]);
    return (
      <CheckboxGroup
        legend="Clinic days"
        hint="Choose all that apply."
        error="Choose at least one day."
        options={[
          { value: 'mon', label: 'Monday' },
          { value: 'tue', label: 'Tuesday' },
          { value: 'wed', label: 'Wednesday' },
        ]}
        value={value}
        onChange={setValue}
      />
    );
  },
};
export const Radios: Story = {
  render: function Render() {
    const [value, setValue] = useState('cash');
    return (
      <RadioGroup
        legend="How did they pay?"
        options={[
          { value: 'cash', label: 'Cash' },
          { value: 'card', label: 'Card' },
          { value: 'gcash', label: 'GCash' },
        ]}
        value={value}
        onChange={setValue}
      />
    );
  },
};
export const Switches: Story = {
  render: function Render() {
    const [on, setOn] = useState(true);
    return (
      <div className="flex flex-col gap-2">
        <Switch
          label="Email reminders"
          description="Takes effect immediately."
          checked={on}
          onCheckedChange={setOn}
        />
        <Switch
          label="SMS reminders"
          description="Not available yet."
          checked={false}
          disabled
          onCheckedChange={() => undefined}
        />
      </div>
    );
  },
};
