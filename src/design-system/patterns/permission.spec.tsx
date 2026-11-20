import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { ActionWithReason, NoAccess, PermissionNote, ReadOnlyField } from './permission.tsx';

describe('ReadOnlyField (can view, cannot change)', () => {
  it('shows the value as text, not as a disabled input', () => {
    renderWithProviders(<ReadOnlyField label="Clinic name" value="Sunrise Clinic" />);
    expect(screen.getByText('Clinic name')).toBeInTheDocument();
    expect(screen.getByText('Sunrise Clinic')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows a dash for an empty value, so a blank is never mistaken for a bug', () => {
    renderWithProviders(<ReadOnlyField label="Phone" value="" />);
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <dl>
        <ReadOnlyField label="Clinic name" value="Sunrise Clinic" />
      </dl>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('PermissionNote', () => {
  it('is a one-line note with an icon that says who can change it', () => {
    const { container } = renderWithProviders(
      <PermissionNote>Only clinic admins can change these details.</PermissionNote>,
    );
    expect(screen.getByText('Only clinic admins can change these details.')).toBeInTheDocument();
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('NoAccess (a direct URL to a page the person may not use)', () => {
  it('says so plainly and tells them what to do', () => {
    renderWithProviders(<NoAccess />);
    expect(
      screen.getByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ask your clinic admin if you need it.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<NoAccess />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ActionWithReason (temporarily unavailable)', () => {
  it('shows the action disabled with the reason written next to it, and linked to it', async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <ActionWithReason reason="Please wait 2 minutes before trying again." onClick={onClick}>
        Sign in
      </ActionWithReason>,
    );
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(screen.getByText('Please wait 2 minutes before trying again.')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Please wait 2 minutes before trying again.');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is a normal button when there is no reason', async () => {
    const onClick = vi.fn();
    renderWithProviders(<ActionWithReason onClick={onClick}>Sign in</ActionWithReason>);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <ActionWithReason reason="Wait.">Sign in</ActionWithReason>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
