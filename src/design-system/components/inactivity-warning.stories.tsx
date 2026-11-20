import type { Meta, StoryObj } from '@storybook/react-vite';

import { InactivityWarning } from './inactivity-warning.tsx';

const meta = {
  title: 'Patterns/Inactivity warning (shared computers)',
  component: InactivityWarning,
  parameters: { docs: { story: { inline: false, iframeHeight: 420 } } },
} satisfies Meta<typeof InactivityWarning>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SixtySeconds: Story = {
  args: { open: true, secondsLeft: 60, onStaySignedIn: () => undefined },
};
export const TenSeconds: Story = {
  args: { open: true, secondsLeft: 10, onStaySignedIn: () => undefined },
};
