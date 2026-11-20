import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button.tsx';
import { EmptyState, ErrorState, LoadingState } from './state-views.tsx';

const meta: Meta = { title: 'Patterns/Empty, loading and error states' };
export default meta;
type Story = StoryObj;

export const EmptyWithAction: Story = {
  render: () => (
    <EmptyState
      title="No branches yet"
      description="Add your first branch to get started."
      action={<Button>Add branch</Button>}
    />
  ),
};
export const EmptyWithoutPermission: Story = {
  render: () => (
    <EmptyState title="No branches yet" description="Ask your clinic admin to add one." />
  ),
};
export const LoadingSpinner: Story = { render: () => <LoadingState label="Loading branches…" /> };
export const LoadingSkeleton: Story = {
  render: () => <LoadingState label="Loading patients…" variant="skeleton" rows={4} />,
};
export const ErrorWithRetryAndSupportDetails: Story = {
  render: () => (
    <ErrorState
      message="We could not load the branches."
      requestId="0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b"
      onRetry={() => undefined}
    />
  ),
};
export const ErrorWithoutRetry: Story = {
  render: () => <ErrorState message="You do not have permission to do this." />,
};
