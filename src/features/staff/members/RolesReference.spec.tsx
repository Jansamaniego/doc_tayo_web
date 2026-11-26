import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { RolesReference } from './RolesReference.tsx';

const API = 'http://localhost:3000/api/v1';

beforeEach(() => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me Myself' },
    memberships: [],
    activeTenantId: 'clinic-a',
    permissions: ['members.read'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('RolesReference', () => {
  it('stays closed, and asks for nothing, until it is opened', () => {
    // An unexpected request fails the test, so this also proves GET /roles is not called.
    renderWithProviders(<RolesReference />);
    const toggle = screen.getByRole('button', { name: 'What each role can do' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('lists each role with what it can do, in words', async () => {
    server.use(
      http.get(`${API}/roles`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'r1',
              key: 'owner',
              name: 'Owner',
              isSystem: true,
              permissions: ['members.read', 'branches.read'],
              assignable: false,
            },
            {
              id: 'r2',
              key: 'doctor',
              name: 'Doctor',
              isSystem: true,
              permissions: ['branches.read'],
              assignable: true,
            },
            {
              id: 'r3',
              key: 'custom',
              name: 'Front desk',
              isSystem: false,
              permissions: [],
              assignable: true,
            },
          ],
        }),
      ),
      http.get(`${API}/permissions`, () =>
        HttpResponse.json({
          data: [
            { key: 'branches.read', description: 'See the clinic’s branches' },
            { key: 'members.read', description: 'See the clinic’s staff' },
          ],
        }),
      ),
    );
    renderWithProviders(<RolesReference />);
    const toggle = screen.getByRole('button', { name: 'What each role can do' });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const owner = await screen.findByRole('region', { name: 'Owner' });
    expect(within(owner).getByText('See the clinic’s staff')).toBeInTheDocument();
    expect(within(owner).getByText('See the clinic’s branches')).toBeInTheDocument();
    const doctor = screen.getByRole('region', { name: 'Doctor' });
    expect(within(doctor).queryByText('See the clinic’s staff')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Front desk' })).toHaveTextContent('No permissions');
  });

  it('shows the key when a permission has no description', async () => {
    server.use(
      http.get(`${API}/roles`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'r1',
              key: 'doctor',
              name: 'Doctor',
              isSystem: true,
              permissions: ['patients.read'],
              assignable: true,
            },
          ],
        }),
      ),
      http.get(`${API}/permissions`, () => HttpResponse.json({ data: [] })),
    );
    renderWithProviders(<RolesReference />);
    await userEvent.click(screen.getByRole('button', { name: 'What each role can do' }));
    expect(await screen.findByText('patients.read')).toBeInTheDocument();
  });

  it('shows an error with its request id and tries again', async () => {
    server.use(
      http.get(`${API}/roles`, () =>
        HttpResponse.json(
          { error: { status: 500, code: 'INTERNAL', message: 'x', requestId: 'req-7' } },
          { status: 500 },
        ),
      ),
      http.get(`${API}/permissions`, () => HttpResponse.json({ data: [] })),
    );
    renderWithProviders(<RolesReference />);
    await userEvent.click(screen.getByRole('button', { name: 'What each role can do' }));
    expect(await screen.findByText(/req-7/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('has no accessibility violations, closed and open', async () => {
    server.use(
      http.get(`${API}/roles`, () =>
        HttpResponse.json({
          data: [
            {
              id: 'r2',
              key: 'doctor',
              name: 'Doctor',
              isSystem: true,
              permissions: ['branches.read'],
              assignable: true,
            },
          ],
        }),
      ),
      http.get(`${API}/permissions`, () =>
        HttpResponse.json({ data: [{ key: 'branches.read', description: 'See branches' }] }),
      ),
    );
    const { container } = renderWithProviders(<RolesReference />);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'What each role can do' }));
    await screen.findByText('See branches');
    expect(await axe(container)).toHaveNoViolations();
  });
});
