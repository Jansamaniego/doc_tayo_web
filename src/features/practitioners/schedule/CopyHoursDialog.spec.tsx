import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/test/render.tsx';

import { CopyHoursDialog } from './CopyHoursDialog.tsx';

function setup({ from = 1, daysWithHours = [1, 2, 4] } = {}) {
  const onCopy = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(
    <CopyHoursDialog from={from} daysWithHours={daysWithHours} onCopy={onCopy} onClose={onClose} />,
  );
  return { onCopy, onClose };
}
const day = (name: string) => screen.getByRole('checkbox', { name: new RegExp(`^${name}`) });
const copyButton = () => screen.getByRole('button', { name: 'Copy hours' });

describe('CopyHoursDialog', () => {
  it('offers the six other days, unticked, marking those that have hours', () => {
    setup();
    expect(screen.getByRole('dialog', { name: "Copy Monday's hours" })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Copy to' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    expect(screen.queryByRole('checkbox', { name: /^Monday/ })).not.toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeChecked();
    expect(day('Tuesday')).toHaveAccessibleName('Tuesday · Has hours');
    expect(day('Wednesday')).toHaveAccessibleName('Wednesday');
  });

  it('says which ticked days will be replaced, before anything is applied', async () => {
    const { onCopy } = setup();
    const status = screen.getByRole('status');
    await userEvent.click(day('Wednesday'));
    expect(status).toBeEmptyDOMElement();
    await userEvent.click(day('Tuesday'));
    expect(status).toHaveTextContent('Tuesday already has hours. They will be replaced.');
    await userEvent.click(day('Thursday'));
    expect(status).toHaveTextContent(
      'Tuesday and Thursday already have hours. They will be replaced.',
    );
    await userEvent.click(day('Tuesday'));
    expect(status).toHaveTextContent('Thursday already has hours. They will be replaced.');
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('copies to the ticked days, in week order', async () => {
    const { onCopy } = setup();
    await userEvent.click(day('Friday'));
    await userEvent.click(day('Tuesday'));
    await userEvent.click(copyButton());
    expect(onCopy).toHaveBeenCalledExactlyOnceWith([2, 5]);
  });

  it('asks for a day when none is ticked', async () => {
    const { onCopy } = setup();
    await userEvent.click(copyButton());
    expect(screen.getByText('Choose at least one day.')).toBeInTheDocument();
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('Cancel and Escape close it without copying', async () => {
    const { onCopy, onClose } = setup();
    await userEvent.click(day('Tuesday'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('has no accessibility violations, with the warning', async () => {
    setup();
    await userEvent.click(day('Tuesday'));
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
