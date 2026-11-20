import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button.tsx';
import { notify, ToastRegion } from './toast.tsx';

const meta: Meta = { title: 'Components/Toast (confirmations only)' };
export default meta;
type Story = StoryObj;

export const Confirmations: Story = {
  render: () => (
    <>
      <ToastRegion />
      <p className="mb-3">
        Toasts are only for confirmations. Errors and actions (even Undo) stay on the page.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            notify.success('Branch saved');
          }}
        >
          Show a success toast
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            notify.info('Invitation sent to ana@example.com. The link works for 7 days.');
          }}
        >
          Show an info toast
        </Button>
      </div>
    </>
  ),
};
