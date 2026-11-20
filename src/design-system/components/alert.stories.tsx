import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button.tsx';
import { Alert } from './alert.tsx';

const meta = {
  title: 'Components/Alert',
  component: Alert,
  args: { children: 'Your changes were saved.' },
} satisfies Meta<typeof Alert>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = { args: { variant: 'success' } };
export const Info: Story = {
  args: {
    variant: 'info',
    title: 'Good to know',
    children: 'The invitation link works for 7 days.',
  },
};
export const Warning: Story = {
  args: {
    variant: 'warning',
    title: 'You are offline',
    children: 'Changes will not be saved until you are back online.',
  },
};
export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'We could not save the branch. Nothing was changed.',
    onDismiss: () => undefined,
  },
};
export const DangerWithRetry: Story = {
  args: {
    variant: 'danger',
    children: 'We could not load the branches.',
    action: <Button>Try again</Button>,
  },
};
