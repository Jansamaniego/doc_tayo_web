import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { Button } from './button.tsx';
import { ConfirmDialog } from './confirm-dialog.tsx';
import { Dialog } from './dialog.tsx';
import { Sheet } from './sheet.tsx';

function DialogHarness({
  dirty = false,
  onClose = () => undefined,
}: {
  dirty?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
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
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onClose();
        }}
        title="Edit branch"
        description="Change the branch details."
        dirty={dirty}
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
        <p>Form goes here.</p>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('is a named dialog with a description, and focus moves inside it', async () => {
    renderWithProviders(<DialogHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit branch' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit branch' });
    expect(dialog).toHaveAccessibleDescription('Change the branch details.');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('has a Close button with words, and footer buttons', async () => {
    renderWithProviders(<DialogHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit branch' }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save branch' })).toBeInTheDocument();
  });

  it('closes with Escape and gives focus back to the button that opened it', async () => {
    renderWithProviders(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Edit branch' });
    await userEvent.click(trigger);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    // Radix hands focus back on a timer.
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('keeps focus inside while open (Tab wraps around)', async () => {
    renderWithProviders(<DialogHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit branch' }));
    const dialog = await screen.findByRole('dialog');
    for (let step = 0; step < 6; step += 1) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  describe('with unsaved changes', () => {
    it('asks before closing on Escape, with "Stay" as the default', async () => {
      const onClose = vi.fn();
      renderWithProviders(<DialogHarness dirty onClose={onClose} />);
      await userEvent.click(screen.getByRole('button', { name: 'Edit branch' }));
      await screen.findByRole('dialog', { name: 'Edit branch' });
      await userEvent.keyboard('{Escape}');
      const ask = await screen.findByRole('alertdialog', { name: 'Leave without saving?' });
      expect(ask).toHaveTextContent('Your changes will be lost.');
      expect(screen.getByRole('button', { name: 'Stay' })).toHaveFocus();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('Stay keeps the dialog open and the work in it', async () => {
      renderWithProviders(<DialogHarness dirty />);
      await userEvent.click(screen.getByRole('button', { name: 'Edit branch' }));
      await screen.findByRole('dialog', { name: 'Edit branch' });
      await userEvent.keyboard('{Escape}');
      await userEvent.click(await screen.findByRole('button', { name: 'Stay' }));
      expect(await screen.findByRole('dialog', { name: 'Edit branch' })).toBeInTheDocument();
      expect(screen.getByText('Form goes here.')).toBeInTheDocument();
    });

    it('Leave closes it', async () => {
      const onClose = vi.fn();
      renderWithProviders(<DialogHarness dirty onClose={onClose} />);
      await userEvent.click(screen.getByRole('button', { name: 'Edit branch' }));
      await screen.findByRole('dialog', { name: 'Edit branch' });
      await userEvent.keyboard('{Escape}');
      await userEvent.click(await screen.findByRole('button', { name: 'Leave' }));
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  it('has no accessibility violations', async () => {
    renderWithProviders(<DialogHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit branch' }));
    await screen.findByRole('dialog');
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});

function ConfirmHarness({
  onConfirm = () => undefined,
  irreversible = false,
  typeToConfirm,
}: {
  onConfirm?: () => void;
  irreversible?: boolean;
  typeToConfirm?: string;
}) {
  const [open, setOpen] = useState(false);
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
        irreversible={irreversible}
        {...(typeToConfirm && { typeToConfirm })}
        onConfirm={onConfirm}
      />
    </>
  );
}

describe('overlays and the Content-Security-Policy', () => {
  // The production policy has no 'unsafe-inline' for styles, so an overlay must never add a <style>
  // element (Radix's scroll lock does, unless it is replaced: src/design-system/scroll-lock.tsx).
  it('opening a dialog adds no <style> element, and locks the page scroll only while open', async () => {
    const before = document.querySelectorAll('style').length;
    renderWithProviders(<ConfirmHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Dr. Santos' }));
    await screen.findByRole('alertdialog');
    expect(document.querySelectorAll('style')).toHaveLength(before);
    expect(document.body).toHaveAttribute('data-scroll-locked');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(document.body).not.toHaveAttribute('data-scroll-locked');
    });
    expect(document.querySelectorAll('style')).toHaveLength(before);
  });
});

describe('ConfirmDialog with typed confirmation (permanent actions)', () => {
  async function open() {
    await userEvent.click(screen.getByRole('button', { name: 'Remove Dr. Santos' }));
    return screen.findByRole('alertdialog');
  }

  it('asks for the exact text, with a visible label, and keeps Cancel as the initial focus', async () => {
    renderWithProviders(<ConfirmHarness typeToConfirm="bayview-clinic" />);
    await open();
    expect(screen.getByLabelText('Type bayview-clinic to confirm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('does nothing and says what is missing while the text does not match, and the dialog stays open', async () => {
    const onConfirm = vi.fn();
    renderWithProviders(<ConfirmHarness typeToConfirm="bayview-clinic" onConfirm={onConfirm} />);
    await open();
    const confirm = screen.getByRole('button', { name: 'Remove' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Type bayview-clinic to confirm'), 'bayview');
    expect(confirm).toHaveAccessibleDescription(/Type bayview-clinic exactly to continue/);
    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms once the text matches (ignoring spaces around it) and closes', async () => {
    const onConfirm = vi.fn();
    renderWithProviders(<ConfirmHarness typeToConfirm="bayview-clinic" onConfirm={onConfirm} />);
    await open();
    await userEvent.type(
      screen.getByLabelText('Type bayview-clinic to confirm'),
      ' bayview-clinic ',
    );
    const confirm = screen.getByRole('button', { name: 'Remove' });
    expect(confirm).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('starts empty each time it opens, and Escape cancels', async () => {
    const onConfirm = vi.fn();
    renderWithProviders(<ConfirmHarness typeToConfirm="bayview-clinic" onConfirm={onConfirm} />);
    await open();
    await userEvent.type(screen.getByLabelText('Type bayview-clinic to confirm'), 'bayview-clinic');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    await open();
    expect(screen.getByLabelText('Type bayview-clinic to confirm')).toHaveValue('');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    renderWithProviders(<ConfirmHarness irreversible typeToConfirm="bayview-clinic" />);
    await open();
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});

describe('ConfirmDialog (destructive actions)', () => {
  it('names the thing and the consequence, and puts initial focus on Cancel', async () => {
    renderWithProviders(<ConfirmHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Dr. Santos' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Remove Dr. Santos from Sunrise Clinic?',
    });
    expect(dialog).toHaveTextContent('They will lose access immediately.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('repeats the verb on the confirm button, in the danger style', async () => {
    renderWithProviders(<ConfirmHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Dr. Santos' }));
    const confirm = await screen.findByRole('button', { name: 'Remove' });
    expect(confirm.className).toContain('bg-danger');
  });

  it('says so when it cannot be undone', async () => {
    renderWithProviders(<ConfirmHarness irreversible />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Dr. Santos' }));
    expect(await screen.findByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('confirms only when asked, and Cancel or Escape do nothing', async () => {
    const onConfirm = vi.fn();
    renderWithProviders(<ConfirmHarness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Dr. Santos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Dr. Santos' }));
    await screen.findByRole('alertdialog');
    await userEvent.keyboard('{Escape}');
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Dr. Santos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    renderWithProviders(<ConfirmHarness irreversible />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Dr. Santos' }));
    await screen.findByRole('alertdialog');
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});

describe('Sheet (side panel on desktop, bottom sheet on mobile)', () => {
  function SheetHarness() {
    const [open, setOpen] = useState(false);
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
          description="Change one thing."
        >
          <p>Sheet content</p>
        </Sheet>
      </>
    );
  }

  it('is a named dialog with a Close button, closed by Escape', async () => {
    renderWithProviders(<SheetHarness />);
    const trigger = screen.getByRole('button', { name: 'Quick edit' });
    await userEvent.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Quick edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('has no accessibility violations', async () => {
    renderWithProviders(<SheetHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Quick edit' }));
    await screen.findByRole('dialog');
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
