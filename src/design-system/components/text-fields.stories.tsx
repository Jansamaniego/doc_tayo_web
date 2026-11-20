import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { MoneyField, PasswordField, SearchField, TextArea, TextField } from './text-fields.tsx';

const meta: Meta = { title: 'Components/Text fields' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => <TextField label="Branch name" autoComplete="off" />,
};
export const WithHint: Story = {
  render: () => (
    <TextField label="Phone" hint="For example: 0917 123 4567" autoComplete="tel" inputMode="tel" />
  ),
};
export const Optional: Story = { render: () => <TextField label="Nickname" optional /> };
export const WithError: Story = {
  render: () => (
    <TextField
      label="Email"
      type="email"
      defaultValue="ana@"
      error="Enter an email address, for example juan@example.com."
    />
  ),
};
export const ReadOnly: Story = {
  render: () => <TextField label="Clinic" readOnly defaultValue="Sunrise Clinic" />,
};
export const Disabled: Story = {
  render: () => <TextField label="Clinic" disabled defaultValue="Sunrise Clinic" />,
};
export const TextAreaWithCounter: Story = {
  render: () => <TextArea label="Notes" maxLength={500} hint="Visible to staff only." />,
};
export const Password: Story = {
  render: () => (
    <PasswordField
      label="New password"
      autoComplete="new-password"
      rules={[
        { text: 'At least 10 characters', met: true },
        { text: 'Not a very common password', met: false },
        { text: 'Does not contain your email address', met: true },
      ]}
    />
  ),
};
export const PasswordWithServerError: Story = {
  render: () => (
    <PasswordField
      label="New password"
      error="This password is too easy to guess. Please choose another."
    />
  ),
};
export const Money: Story = {
  render: function Render() {
    const [value, setValue] = useState<number | null>(125050);
    return <MoneyField label="Consultation fee" value={value} onChange={setValue} />;
  },
};
export const Search: Story = {
  render: function Render() {
    const [value, setValue] = useState('dela cruz');
    return (
      <SearchField
        label="Search patients"
        value={value}
        onChange={setValue}
        onSearch={() => undefined}
        resultSummary="12 patients found"
      />
    );
  },
};
