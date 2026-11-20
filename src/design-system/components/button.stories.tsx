import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus, Save } from 'lucide-react';

import { Button } from './button.tsx';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Save branch' },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary', children: 'Cancel' } };
export const Tertiary: Story = { args: { variant: 'tertiary', children: 'Skip for now' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Remove' } };
export const DangerSecondary: Story = { args: { variant: 'danger-secondary', children: 'Remove' } };
export const WithIcon: Story = {
  args: { icon: <Plus className="size-5" />, children: 'Add patient' },
};
export const Large: Story = {
  args: { size: 'lg', icon: <Save className="size-6" />, children: 'Save patient' },
};
export const Loading: Story = { args: { loading: true, loadingText: 'Saving…' } };
export const Disabled: Story = { args: { disabled: true } };
export const UnavailableWithReason: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button unavailable aria-describedby="why">
        Add branch
      </Button>
      <p id="why">Only clinic admins can add branches.</p>
    </div>
  ),
};
