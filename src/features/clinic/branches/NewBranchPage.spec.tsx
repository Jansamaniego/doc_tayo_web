import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { NewBranchPage } from './NewBranchPage.tsx';

const API = 'http://localhost:3000/api/v1';
const errorBody = (status: number, code: string, details: unknown[] = []) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-8', details } },
    { status },
  );

beforeEach(() => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me Myself' },
    memberships: [
      {
        tenantId: 'clinic-a',
        tenantName: 'Sunrise Clinic',
        tenantStatus: 'active',
        membershipStatus: 'active',
        roles: [{ key: 'clinic_admin', name: 'Clinic admin' }],
      },
    ],
    activeTenantId: 'clinic-a',
    permissions: ['tenant.read', 'branches.read', 'branches.manage'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

function setup(reply?: () => Response) {
  const bodies: unknown[] = [];
  server.use(
    http.get(`${API}/tenant`, () =>
      HttpResponse.json({
        data: {
          id: 'clinic-a',
          name: 'Sunrise Clinic',
          slug: 'sunrise',
          status: 'active',
          timezone: 'Asia/Manila',
          contactEmail: null,
          contactPhone: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    ),
    http.post(`${API}/branches`, async ({ request }) => {
      bodies.push(await request.json());
      return (
        reply?.() ??
        HttpResponse.json(
          {
            data: {
              id: 'b9',
              name: 'Annex',
              addressLine: null,
              city: null,
              province: null,
              timezone: null,
              isActive: true,
              createdAt: '2026-11-24T00:00:00.000Z',
              updatedAt: '2026-11-24T00:00:00.000Z',
            },
          },
          { status: 201 },
        )
      );
    }),
  );
  const onCreated = vi.fn();
  const view = renderWithProviders(<NewBranchPage onCreated={onCreated} />);
  return { bodies, onCreated, ...view };
}
const type = (label: string | RegExp, text: string) =>
  userEvent.type(screen.getByLabelText(label), text);
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Add branch' }));

describe('NewBranchPage', () => {
  it('shows the form with the clinic’s time zone as the hint', async () => {
    setup();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Add a branch' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Leave empty to use the clinic's time zone (Asia/Manila)."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Active/)).not.toBeInTheDocument();
  });

  it('leaves empty optional fields out of the request, and always creates an active branch', async () => {
    const { bodies, onCreated } = setup();
    await type('Branch name', '  Annex ');
    await submit();
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith({ id: 'b9', name: 'Annex' });
    });
    expect(bodies).toEqual([{ name: 'Annex', isActive: true }]);
  });

  it('sends the optional fields that were filled in, including a chosen time zone', async () => {
    const { bodies } = setup();
    await type('Branch name', 'Annex');
    await type(/^Address/, '2 Mabini St');
    await type(/^City/, 'Pasig');
    await type(/^Province/, 'Metro Manila');
    await userEvent.click(screen.getByRole('combobox', { name: /^Time zone/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'Asia/Tokyo' }));
    await submit();
    await waitFor(() => {
      expect(bodies).toEqual([
        {
          name: 'Annex',
          addressLine: '2 Mabini St',
          city: 'Pasig',
          province: 'Metro Manila',
          timezone: 'Asia/Tokyo',
          isActive: true,
        },
      ]);
    });
  });

  it.each([
    ['a blank name', 'Branch name', '', 'Enter the branch name.'],
    ['a name over 120 characters', 'Branch name', 'x'.repeat(121), 'Use at most 120 characters.'],
    ['an address over 200 characters', /^Address/, 'x'.repeat(201), 'Use at most 200 characters.'],
    ['a city over 120 characters', /^City/, 'x'.repeat(121), 'Use at most 120 characters.'],
  ])('refuses %s before sending anything', async (_label, field, typed, message) => {
    const { bodies } = setup();
    if (field !== 'Branch name') await type('Branch name', 'Annex');
    if (typed) await type(field, typed);
    await submit();
    expect((await screen.findAllByText(message)).length).toBeGreaterThan(0);
    expect(bodies).toEqual([]);
  });

  it('accepts a name of exactly 120 characters', async () => {
    const { bodies } = setup();
    await type('Branch name', 'x'.repeat(120));
    await submit();
    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
  });

  it('says the clinic already has a branch with that name, on the name field, keeping the input', async () => {
    const { onCreated } = setup(() => errorBody(409, 'CONFLICT_UNIQUE'));
    await type('Branch name', 'Main');
    await submit();
    expect(
      (await screen.findAllByText('Your clinic already has a branch with this name.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText('Branch name')).toHaveValue('Main');
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('puts the API’s field problems under their fields', async () => {
    setup(() =>
      errorBody(400, 'VALIDATION_FAILED', [
        { field: 'city', code: 'TOO_LONG', message: 'too long' },
      ]),
    );
    await type('Branch name', 'Annex');
    await type(/^City/, 'Pasig');
    await submit();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText(/^City/)).toHaveValue('Pasig');
  });

  it('the summary’s "Time zone" link moves focus to the picker', async () => {
    setup(() =>
      errorBody(400, 'VALIDATION_FAILED', [
        { field: 'timezone', code: 'INVALID_VALUE', message: 'x' },
      ]),
    );
    await type('Branch name', 'Annex');
    await submit();
    const summary = await screen.findByRole('alert');
    await userEvent.click(within(summary).getByRole('link', { name: 'Time zone' }));
    expect(screen.getByRole('combobox', { name: /Time zone/ })).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = setup();
    await screen.findByRole('heading', { level: 1, name: 'Add a branch' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
