import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { DateField, DatePicker, DateRangePicker, TimeField } from './date-fields.tsx';

const meta: Meta = { title: 'Components/Date and time' };
export default meta;
type Story = StoryObj;

export const DateTyped: Story = {
  render: function Render() {
    const [value, setValue] = useState('1980-03-08');
    return (
      <DateField
        legend="Date of birth"
        value={value}
        onChange={setValue}
        hint="Typing always works."
      />
    );
  },
};
export const DateWithCalendar: Story = {
  render: function Render() {
    const [value, setValue] = useState('2026-11-20');
    return <DatePicker legend="Appointment date" value={value} onChange={setValue} />;
  },
};
export const DateImpossible: Story = {
  render: () => (
    <DateField
      legend="Date of birth"
      value=""
      onChange={() => undefined}
      error="Enter the date of birth."
    />
  ),
};
export const DateWithLimits: Story = {
  render: function Render() {
    const [value, setValue] = useState('2020-01-01');
    return (
      <DatePicker
        legend="Appointment date"
        value={value}
        onChange={setValue}
        min="2026-11-01"
        max="2026-12-31"
      />
    );
  },
};
export const Time: Story = {
  render: function Render() {
    const [value, setValue] = useState('14:30');
    return <TimeField legend="Start time" value={value} onChange={setValue} />;
  },
};
export const Range: Story = {
  render: function Render() {
    const [value, setValue] = useState({ from: '2026-11-01', to: '2026-11-30' });
    return <DateRangePicker legend="Report period" value={value} onChange={setValue} />;
  },
};
export const RangeEndBeforeStart: Story = {
  render: () => (
    <DateRangePicker
      legend="Report period"
      value={{ from: '2026-11-30', to: '2026-11-01' }}
      onChange={() => undefined}
    />
  ),
};
