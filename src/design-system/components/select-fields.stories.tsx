import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Combobox, SelectField } from './select-fields.tsx';

const meta: Meta = { title: 'Components/Select and Combobox' };
export default meta;
type Story = StoryObj;

const BRANCHES = [
  { value: 'main', label: 'Main' },
  { value: 'qc', label: 'Quezon City Annex' },
  { value: 'cebu', label: 'Cebu' },
];
const DOCTORS = Array.from({ length: 30 }, (_, index) => ({
  value: String(index),
  label: `Dr. ${['Reyes', 'Lim', 'Cruz', 'Santos', 'Tan'][index % 5]} ${String.fromCharCode(65 + (index % 26))}.`,
}));

export const NativeSelect: Story = {
  render: function Render() {
    const [value, setValue] = useState('');
    return (
      <SelectField
        label="Branch"
        options={BRANCHES}
        value={value}
        onChange={setValue}
        emptyOption="Choose a branch"
        hint="Use this for short lists."
      />
    );
  },
};
export const NativeSelectWithError: Story = {
  render: () => (
    <SelectField
      label="Branch"
      options={BRANCHES}
      value=""
      onChange={() => undefined}
      emptyOption="Choose a branch"
      error="Choose a branch."
    />
  ),
};
export const SearchableCombobox: Story = {
  render: function Render() {
    const [value, setValue] = useState('');
    return (
      <Combobox
        label="Doctor"
        options={DOCTORS}
        value={value}
        onChange={setValue}
        hint="Use this for long lists."
      />
    );
  },
};

export const GroupedSelect: Story = {
  render: function Render() {
    const [value, setValue] = useState('');
    return (
      <SelectField
        label="Practitioner"
        options={[]}
        groups={[
          { label: 'Works at Main', options: [{ value: '1', label: 'Dr. Ana Reyes' }] },
          { label: 'Other practitioners', options: [{ value: '2', label: 'Dr. Ben Lim' }] },
        ]}
        value={value}
        onChange={setValue}
        emptyOption="Choose a practitioner"
      />
    );
  },
};
function SearchedByServer({ loading = false, found = true }) {
  const [value, setValue] = useState('');
  return (
    <Combobox
      label="Patient"
      options={found ? DOCTORS.slice(0, 5) : []}
      value={value}
      onChange={setValue}
      search={{
        onQueryChange: () => undefined,
        loading,
        empty: <p>No patient found</p>,
      }}
    />
  );
}
export const ServerSearchedCombobox: Story = { render: () => <SearchedByServer /> };
export const ServerSearchedComboboxSearching: Story = {
  render: () => <SearchedByServer loading />,
};
export const ServerSearchedComboboxNothingFound: Story = {
  render: () => <SearchedByServer found={false} />,
};
