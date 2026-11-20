import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { InactivityWarning } from './inactivity-warning.tsx';

describe('InactivityWarning (shared computers)', () => {
  it('warns in plain words with a countdown in text, as an alert dialog', async () => {
    renderWithProviders(
      <InactivityWarning open secondsLeft={60} onStaySignedIn={() => undefined} />,
    );
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('For privacy, you will be signed out in 60 seconds.');
  });

  it('updates the countdown', () => {
    const { rerender } = renderWithProviders(
      <InactivityWarning open secondsLeft={60} onStaySignedIn={() => undefined} />,
    );
    rerender(<InactivityWarning open secondsLeft={42} onStaySignedIn={() => undefined} />);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('42 seconds');
  });

  it('has one large "Stay signed in" button, focused, that keeps the session', async () => {
    const onStay = vi.fn();
    renderWithProviders(<InactivityWarning open secondsLeft={30} onStaySignedIn={onStay} />);
    const button = await screen.findByRole('button', { name: 'Stay signed in' });
    expect(button).toHaveFocus();
    expect(button.className).toContain('min-h-control-lg');
    await userEvent.click(button);
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it('reassures that unsaved input is kept for the same person', async () => {
    renderWithProviders(
      <InactivityWarning open secondsLeft={30} onStaySignedIn={() => undefined} />,
    );
    expect(
      await screen.findByText(/anything you have not saved will be kept for you/i),
    ).toBeInTheDocument();
  });

  it('is not shown when closed', () => {
    renderWithProviders(
      <InactivityWarning open={false} secondsLeft={60} onStaySignedIn={() => undefined} />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('cannot be dismissed by Escape alone: only "Stay signed in" keeps the session', async () => {
    const onStay = vi.fn();
    renderWithProviders(<InactivityWarning open secondsLeft={30} onStaySignedIn={onStay} />);
    await screen.findByRole('alertdialog');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    renderWithProviders(
      <InactivityWarning open secondsLeft={60} onStaySignedIn={() => undefined} />,
    );
    await screen.findByRole('alertdialog');
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
