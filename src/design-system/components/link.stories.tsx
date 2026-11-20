import type { Meta, StoryObj } from '@storybook/react-vite';

import { TextLink } from './link.tsx';

const meta = { title: 'Components/TextLink', component: TextLink } satisfies Meta<typeof TextLink>;
export default meta;
type Story = StoryObj<typeof meta>;

export const InText: Story = {
  render: () => (
    <p>
      Read the <TextLink href="/help">help page</TextLink> for more.
    </p>
  ),
};
export const Standalone: Story = {
  args: { href: '/help', standalone: true, children: 'Go to the help page' },
};
