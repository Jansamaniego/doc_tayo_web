import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore, type Membership } from '@/api/session/session-store.ts';
import { fakeController } from '@/test/fake-session.tsx';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { NewPractitionerPage } from './NewPractitionerPage.tsx';

const API = 'http://localhost:3000/api/v1';
const clinic = (tenantId: string, tenantName: string): Membership => ({
  tenantId,
  tenantName,
  tenantStatus: 'active',
  membershipStatus: 'active',
  roles: [],
});
function signIn(activeTenantId = 'clinic-a') {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me' },
    memberships: [clinic('clinic-a', 'Sunrise Clinic'), clinic('clinic-b', 'Lakeside Clinic')],
    activeTenantId,
    permissions: ['directory.read', 'practitioners.manage'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
}
const entry = (
  n: number,
  fullName: string,
  practitioner: unknown = null,
  jobTitle: string | null = null,
) => ({
  membershipId: `m${n}`,
  fullName,
  jobTitle,
  roles: [],
  practitioner,
});
const STAFF = [
  entry(1, 'Ana Cruz', null, 'Physician'),
  entry(2, 'Ben Lim'),
  entry(3, 'Carla Reyes', {
    profileId: 'pr3',
    displayName: 'Dr. Carla',
    specialization: null,
    isActive: false,
  }),
];
const errorBody = (status: number, code: string, details: unknown[] = []) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-np', details } },
    { status },
  );

function setup(reply?: () => Response, staff = STAFF) {
  const state = { staff, gets: 0 };
  const sent: { body: unknown; tenant: string | null }[] = [];
  server.use(
    http.get(`${API}/directory`, () => {
      state.gets += 1;
      return HttpResponse.json({
        data: state.staff,
        meta: { page: 1, pageSize: 100, totalItems: state.staff.length, totalPages: 1 },
      });
    }),
    http.post(`${API}/practitioners`, async ({ request }) => {
      sent.push({
        body: await request.json(),
        tenant: request.headers.get('x-expected-tenant-id'),
      });
      return reply
        ? reply()
        : HttpResponse.json(
            { data: { id: 'pr9', membershipId: 'm1', displayName: 'Dra. Ana Cruz, MD' } },
            { status: 201 },
          );
    }),
  );
  const onCreated = vi.fn();
  const controller = fakeController();
  const view = renderWithProviders(<NewPractitionerPage onCreated={onCreated} />, { controller });
  return { state, sent, onCreated, controller, ...view };
}

const person = () => screen.getByRole('combobox', { name: /Person/ });
const choose = async (name: RegExp) => {
  await userEvent.click(await screen.findByRole('combobox', { name: /Person/ }));
  await userEvent.click(await screen.findByRole('option', { name }));
};
const field = (label: RegExp) => screen.getByLabelText(label);
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Add practitioner' }));
const shows = async (text: string) => {
  expect(await screen.findAllByText(text)).not.toHaveLength(0);
};

beforeEach(() => {
  signIn();
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('NewPractitionerPage: choosing the person', () => {
  it('offers only active staff without a profile, with their job title', async () => {
    setup();
    await userEvent.click(await screen.findByRole('combobox', { name: /Person/ }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Ana Cruz · Physician',
      'Ben Lim',
    ]);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Add a practitioner' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/practitioners');
  });

  it('explains that the Doctor role alone does not make a practitioner', async () => {
    setup();
    expect(
      await screen.findByText(/Giving someone the Doctor role does not make them a practitioner/),
    ).toBeInTheDocument();
  });

  it('says so when everyone is already a practitioner, with no form to fill', async () => {
    setup(undefined, STAFF.slice(2));
    expect(
      await screen.findByText('Everyone on your staff is already a practitioner.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add practitioner' })).not.toBeInTheDocument();
  });

  it('fills the display name with the person’s name, and follows another choice', async () => {
    setup();
    await choose(/Ana Cruz/);
    expect(field(/^Display name/)).toHaveValue('Ana Cruz');
    await choose(/Ben Lim/);
    expect(field(/^Display name/)).toHaveValue('Ben Lim');
  });

  it('never overwrites a display name the manager typed', async () => {
    setup();
    await choose(/Ana Cruz/);
    await userEvent.clear(field(/^Display name/));
    await userEvent.type(field(/^Display name/), 'Dra. Ana Cruz, MD');
    await choose(/Ben Lim/);
    expect(field(/^Display name/)).toHaveValue('Dra. Ana Cruz, MD');
  });
});

describe('NewPractitionerPage: adding', () => {
  it('sends the member and the trimmed fields in the opened clinic, then reloads the session', async () => {
    const { sent, onCreated, controller } = setup();
    await choose(/Ana Cruz/);
    await userEvent.clear(field(/^Display name/));
    await userEvent.type(field(/^Display name/), '  Dra. Ana Cruz, MD ');
    await userEvent.type(field(/^Specialization/), 'Pediatrics');
    await submit();
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'pr9' }));
    });
    expect(sent).toEqual([
      {
        body: {
          membershipId: 'm1',
          displayName: 'Dra. Ana Cruz, MD',
          specialization: 'Pediatrics',
        },
        tenant: 'clinic-a',
      },
    ]);
    // The person may have made themselves a practitioner: "My schedule" follows.
    expect(controller.refreshPermissions).toHaveBeenCalled();
  });

  it('requires a person and a display name, showing both problems', async () => {
    const { sent } = setup();
    await screen.findByRole('combobox', { name: /Person/ });
    await submit();
    await shows('Choose the person.');
    await shows('Enter how the name is printed.');
    expect(sent).toEqual([]);
  });

  it('the summary’s "Person" link moves focus to the picker', async () => {
    setup();
    await screen.findByRole('combobox', { name: /Person/ });
    await submit();
    const summary = await screen.findByRole('alert');
    await userEvent.click(within(summary).getByRole('link', { name: 'Person' }));
    expect(person()).toHaveFocus();
  });

  it.each([
    [/^Display name/, 160],
    [/^Specialization/, 120],
    [/^PRC license number/, 40],
    [/^PTR number/, 40],
  ] as const)('accepts %s at %d characters and refuses one more', async (label, limit) => {
    const { sent } = setup();
    await choose(/Ana Cruz/);
    await userEvent.clear(field(label));
    await userEvent.click(field(label));
    await userEvent.paste('x'.repeat(limit + 1));
    await submit();
    await shows(`This can have at most ${limit} characters.`);
    expect(sent).toEqual([]);
    await userEvent.clear(field(label));
    await userEvent.paste('x'.repeat(limit));
    await submit();
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
  });

  it('CONFLICT_UNIQUE says they are already a practitioner and links to their page', async () => {
    const context = setup(() => {
      context.state.staff = [
        entry(1, 'Ana Cruz', {
          profileId: 'pr-existing',
          displayName: 'Dr. Ana',
          specialization: null,
          isActive: true,
        }),
        ...STAFF.slice(1, 2),
      ];
      return errorBody(409, 'CONFLICT_UNIQUE');
    });
    await choose(/Ana Cruz/);
    await submit();
    await shows('This person is already a practitioner here.');
    expect(
      await screen.findByRole('link', { name: 'Open their practitioner page' }),
    ).toHaveAttribute('href', '/practitioners/pr-existing');
    expect(context.onCreated).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'CONFLICT'],
    [404, 'NOT_FOUND'],
  ])(
    '%s %s says the person is no longer active and reads the staff again',
    async (status, code) => {
      const { state, onCreated } = setup(() => errorBody(status, code));
      await choose(/Ana Cruz/);
      const before = state.gets;
      await submit();
      await shows('This person is no longer an active member.');
      await waitFor(() => {
        expect(state.gets).toBeGreaterThan(before);
      });
      expect(onCreated).not.toHaveBeenCalled();
    },
  );

  it('puts the API’s field problems under their fields and keeps what was typed', async () => {
    setup(() =>
      errorBody(400, 'VALIDATION_FAILED', [
        { field: 'specialization', code: 'TOO_LONG', message: 'x' },
      ]),
    );
    await choose(/Ana Cruz/);
    await userEvent.type(field(/^Specialization/), 'Heart');
    await submit();
    await shows('This is too long.');
    expect(field(/^Specialization/)).toHaveValue('Heart');
  });

  it('names both clinics when another one was chosen meanwhile, keeping the input', async () => {
    const { sent } = setup(() => errorBody(409, 'TENANT_MISMATCH'));
    await choose(/Ana Cruz/);
    act(() => {
      signIn('clinic-b');
    });
    await submit();
    await shows(
      'This page was opened for Sunrise Clinic. You are now working in Lakeside Clinic. Nothing was saved.',
    );
    expect(sent[0]?.tenant).toBe('clinic-a');
    expect(field(/^Display name/)).toHaveValue('Ana Cruz');
  });

  it('shows another failure with its request id', async () => {
    setup(() => errorBody(500, 'INTERNAL_ERROR'));
    await choose(/Ana Cruz/);
    await submit();
    expect(await screen.findByText(/req-np/)).toBeInTheDocument();
  });

  it('has no accessibility violations, empty and with errors', async () => {
    const { container } = setup();
    await screen.findByRole('combobox', { name: /Person/ });
    expect(await axe(container)).toHaveNoViolations();
    await submit();
    await shows('Choose the person.');
    expect(await axe(container)).toHaveNoViolations();
    expect(person()).toBeInTheDocument();
  });
});
