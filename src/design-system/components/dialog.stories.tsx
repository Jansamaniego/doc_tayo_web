import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from './button.tsx';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { Dialog } from './dialog.tsx';
import { Sheet } from './sheet.tsx';
import { TextField } from './text-fields.tsx';

const meta: Meta = {
  title: 'Components/Dialog, confirmation and sheet',
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
};
export default meta;
type Story = StoryObj;

export const EditDialog: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button
          onClick={() => {
            setOpen(true);
          }}
        >
          Edit branch
        </Button>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="Edit branch"
          description="Change the branch details."
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setOpen(false);
                }}
              >
                Save branch
              </Button>
            </>
          }
        >
          <TextField label="Branch name" defaultValue="Main" />
        </Dialog>
      </>
    );
  },
};
export const DialogWithUnsavedChanges: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button
          onClick={() => {
            setOpen(true);
          }}
        >
          Edit branch
        </Button>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="Edit branch"
          description="Press Escape or Close: it asks before it throws your changes away."
          dirty
          footer={
            <Button
              onClick={() => {
                setOpen(false);
              }}
            >
              Save branch
            </Button>
          }
        >
          <TextField label="Branch name" defaultValue="Main (edited)" />
        </Dialog>
      </>
    );
  },
};
export const ConfirmRemove: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button
          variant="danger-secondary"
          onClick={() => {
            setOpen(true);
          }}
        >
          Remove Dr. Santos
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Remove Dr. Santos from Sunrise Clinic?"
          description="They will lose access immediately."
          confirmLabel="Remove"
          onConfirm={() => undefined}
        />
      </>
    );
  },
};
export const ConfirmIrreversible: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sign out on all devices?"
        description="Everyone using your account will have to sign in again."
        confirmLabel="Sign out everywhere"
        irreversible
        onConfirm={() => undefined}
      />
    );
  },
};
export const QuickEditSheet: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button
          onClick={() => {
            setOpen(true);
          }}
        >
          Quick edit
        </Button>
        <Sheet
          open={open}
          onOpenChange={setOpen}
          title="Quick edit"
          description="A side panel on desktop, a bottom sheet on a phone."
        >
          <TextField label="Branch name" defaultValue="Main" />
        </Sheet>
      </>
    );
  },
};
