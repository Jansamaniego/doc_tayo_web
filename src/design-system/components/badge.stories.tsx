import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusPill } from './badge.tsx';

const meta = { title: 'Components/StatusPill', component: StatusPill } satisfies Meta<
  typeof StatusPill
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AllStatuses: Story = {
  args: { status: 'success', children: 'Checked in' },
  render: () => (
    <div className="flex flex-wrap gap-3">
      <StatusPill status="success">Checked in</StatusPill>
      <StatusPill status="warning">Waiting</StatusPill>
      <StatusPill status="danger">Cancelled</StatusPill>
      <StatusPill status="info">Booked</StatusPill>
      <StatusPill status="neutral">Archived</StatusPill>
    </div>
  ),
};
