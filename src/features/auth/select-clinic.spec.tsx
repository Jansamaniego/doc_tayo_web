import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ApiError } from '@/api/errors.ts';
import type { Membership } from '@/api/session/session-store.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { SelectClinic } from './select-clinic.tsx';

const membership = (over: Partial<Membership>): Membership => ({
  tenantId: 'a',
  tenantName: 'Sunrise Clinic',
  tenantStatus: 'active',
  membershipStatus: 'active',
  roles: [{ key: 'owner', name: 'Owner' }],
  ...over,
});
const SUNRISE = membership({});
const HARBOR = membership({
  tenantId: 'b',
  tenantName: 'Harbor Clinic',
  roles: [{ key: 'receptionist', name: 'Receptionist' }],
});
const SUSPENDED = membership({
  tenantId: 'c',
  tenantName: 'Old Town Clinic',
  tenantStatus: 'suspended',
});
const CLOSED = membership({
  tenantId: 'd',
  tenantName: 'Closed Clinic',
  tenantStatus: 'deactivated',
});
const REMOVED = membership({
  tenantId: 'e',
  tenantName: 'Former Clinic',
  membershipStatus: 'removed',
});

describe('SelectClinic', () => {
  it("lists each usable clinic with the person's role there, and opens the one they choose", async () => {
    const onSelect = vi.fn(() => Promise.resolve());
    renderWithProviders(
      <SelectClinic
        memberships={[SUNRISE, HARBOR]}
        onSelect={onSelect}
        onSignOut={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Choose a clinic' })).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Receptionist')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Harbor Clinic/ }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('shows a suspended, closed or removed clinic as unavailable, with the reason in words, and cannot be chosen', () => {
    const onSelect = vi.fn(() => Promise.resolve());
    renderWithProviders(
      <SelectClinic
        memberships={[SUNRISE, SUSPENDED, CLOSED, REMOVED]}
        onSelect={onSelect}
        onSignOut={() => undefined}
      />,
    );
    const unavailable = screen.getByRole('list', { name: 'Not available' });
    expect(within(unavailable).getByText('Old Town Clinic')).toBeInTheDocument();
    expect(within(unavailable).getByText('Suspended')).toBeInTheDocument();
    expect(within(unavailable).getByText('No longer active')).toBeInTheDocument();
    expect(within(unavailable).getByText('You no longer have access')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Old Town Clinic/ })).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('says what to do when there is no usable clinic, and offers to sign out', async () => {
    const onSignOut = vi.fn();
    renderWithProviders(
      <SelectClinic
        memberships={[SUSPENDED]}
        onSelect={() => Promise.resolve()}
        onSignOut={onSignOut}
      />,
    );
    expect(screen.getByText("You don't have a clinic you can open right now.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('shows a clear loading state on the chosen clinic and cannot be chosen twice', async () => {
    let finish!: () => void;
    const onSelect = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderWithProviders(
      <SelectClinic
        memberships={[SUNRISE, HARBOR]}
        onSelect={onSelect}
        onSignOut={() => undefined}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Sunrise Clinic/ }));
    expect(screen.getByRole('button', { name: /Opening/ })).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Harbor Clinic/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    finish();
  });

  it('shows the reason on the page if the clinic turns out to be unavailable', async () => {
    const onSelect = vi.fn(() =>
      Promise.reject(
        new ApiError({
          status: 403,
          code: 'TENANT_SUSPENDED',
          message: 'x',
          details: [],
          requestId: 'r',
        }),
      ),
    );
    renderWithProviders(
      <SelectClinic
        memberships={[SUNRISE, HARBOR]}
        onSelect={onSelect}
        onSignOut={() => undefined}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Sunrise Clinic/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This clinic's access is suspended for now.",
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <SelectClinic
        memberships={[SUNRISE, HARBOR, SUSPENDED]}
        onSelect={() => Promise.resolve()}
        onSignOut={() => undefined}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
