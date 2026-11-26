import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore, type Membership } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { EditPatientPage } from './EditPatientPage.tsx';

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
    permissions: ['tenant.read', 'patients.read', 'patients.manage'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
}
const patient = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  patientNumber: 'P-000001',
  firstName: 'Ana',
  middleName: null,
  lastName: 'Cruz',
  suffix: null,
  sex: 'female',
  birthDate: '1990-05-01',
  phone: '+639171111111',
  email: null,
  addressLine: null,
  city: 'Pasig',
  province: null,
  guardianName: null,
  guardianPhone: null,
  allergies: null,
  notes: null,
  archivedAt: null,
  archiveReason: null,
  version: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});
const errorBody = (status: number, code: string, details: unknown[] = []) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-e', details } },
    { status },
  );

interface Sent {
  body: Record<string, unknown>;
  tenant: string | null;
}

/** A fake record: GET answers with `state.record`; PATCH answers each reply in turn, then saves. */
function setup({
  record = patient(),
  replies = [] as ((state: { record: Record<string, unknown> }) => Response)[],
} = {}) {
  const state = { record: record as Record<string, unknown>, gets: 0 };
  const sent: Sent[] = [];
  server.use(
    http.get(`${API}/tenant`, () => HttpResponse.json({ data: { timezone: 'Asia/Manila' } })),
    http.get(`${API}/patients/p1`, () => {
      state.gets += 1;
      return HttpResponse.json({ data: state.record });
    }),
    http.patch(`${API}/patients/p1`, async ({ request }) => {
      sent.push({
        body: (await request.json()) as Record<string, unknown>,
        tenant: request.headers.get('x-expected-tenant-id'),
      });
      const reply = replies.shift();
      return reply ? reply(state) : HttpResponse.json({ data: state.record });
    }),
  );
  const onSaved = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = renderWithProviders(<EditPatientPage patientId="p1" onSaved={onSaved} />, {
    queryClient,
  });
  return { state, sent, onSaved, queryClient, ...view };
}

const field = (label: RegExp) => screen.getByLabelText(label);
const ready = () => screen.findByRole('button', { name: 'Save changes' });
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
const retype = async (label: RegExp, text: string) => {
  await userEvent.clear(field(label));
  if (text) await userEvent.type(field(label), text);
};
const shows = async (text: string) => {
  expect(await screen.findAllByText(text)).not.toHaveLength(0);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-01T20:00:00.000Z') });
  signIn();
});
afterEach(() => {
  vi.useRealTimers();
  sessionStore.set({ status: 'signed-out' });
});

describe('EditPatientPage: the form', () => {
  it('starts filled from the record, titled without the name, with a way back', async () => {
    setup();
    await ready();
    expect(screen.getByRole('heading', { level: 1, name: 'Edit patient' })).toBeInTheDocument();
    expect(document.title).toBe('Edit patient');
    expect(field(/^First name/)).toHaveValue('Ana');
    expect(field(/^Phone/)).toHaveValue('+639171111111');
    expect(field(/^Email/)).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Female' })).toBeChecked();
    expect(screen.getByLabelText('Year')).toHaveValue('1990');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/patients/p1');
    // Editing shows no "same person?" check.
    expect(
      screen.queryByRole('region', { name: 'Is this the same person?' }),
    ).not.toBeInTheDocument();
  });

  it('sends only the changed fields with the version, in the clinic it was opened in, then confirms', async () => {
    const { sent, onSaved } = setup();
    await ready();
    await retype(/^City/, 'Makati');
    await retype(/^Phone/, '');
    await save();
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(sent).toEqual([
      { body: { version: 3, city: 'Makati', phone: null }, tenant: 'clinic-a' },
    ]);
  });

  it('sends nothing when nothing changed, and says so', async () => {
    const { sent, onSaved } = setup();
    await ready();
    await save();
    expect(await screen.findByText('Nothing to change.')).toBeInTheDocument();
    expect(sent).toEqual([]);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('refuses an emptied name', async () => {
    const { sent } = setup();
    await ready();
    await retype(/^Last name/, '');
    await save();
    await shows('Enter the last name.');
    expect(sent).toEqual([]);
  });

  it('refuses a changed birth date after today, but does not block an untouched one', async () => {
    // The API accepts "tomorrow" for clinics ahead of UTC: an existing record must stay editable.
    const { sent } = setup({ record: patient({ birthDate: '2026-03-03' }) });
    await ready();
    await retype(/^City/, 'Makati');
    await save();
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.body).toEqual({ version: 3, city: 'Makati' });
  });

  it('refuses a half-typed birth date', async () => {
    const { sent } = setup();
    await ready();
    await userEvent.clear(screen.getByLabelText('Year'));
    await userEvent.type(screen.getByLabelText('Year'), '19');
    await save();
    await shows('Complete the birth date with a real date, or leave it empty.');
    expect(sent).toEqual([]);
  });

  it('shows the archived banner on an archived patient, which can still be edited', async () => {
    const { sent } = setup({
      record: patient({ archivedAt: '2026-01-31T20:00:00.000Z', archiveReason: 'Moved away' }),
    });
    await ready();
    expect(await screen.findByText(/Archived on Feb 1, 2026: Moved away/)).toBeInTheDocument();
    await retype(/^City/, 'Makati');
    await save();
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
  });

  it('puts the API’s field problems under their fields and keeps what was typed', async () => {
    setup({
      replies: [
        () =>
          errorBody(400, 'VALIDATION_FAILED', [
            { field: 'phone', code: 'INVALID_FORMAT', message: 'x' },
          ]),
      ],
    });
    await ready();
    await retype(/^Phone/, '02 8123 4567');
    await save();
    await shows(
      'Enter a mobile number, or start a landline or foreign number with + and the country code.',
    );
    expect(field(/^Phone/)).toHaveValue('02 8123 4567');
  });

  it('shows any other failure with its request id and keeps the input', async () => {
    setup({ replies: [() => errorBody(500, 'INTERNAL_ERROR')] });
    await ready();
    await retype(/^City/, 'Makati');
    await save();
    expect(await screen.findByText(/req-e/)).toBeInTheDocument();
    expect(field(/^City/)).toHaveValue('Makati');
  });
});

describe('EditPatientPage: someone else saved first', () => {
  const theirs = patient({
    version: 4,
    city: 'Makati',
    phone: '+639182222222',
    birthDate: null,
    sex: 'unknown',
  });
  const conflict = (state: { record: Record<string, unknown> }) => {
    state.record = theirs;
    return errorBody(409, 'VERSION_CONFLICT');
  };

  async function collide() {
    const context = setup({ replies: [conflict] });
    await ready();
    await retype(/^Phone/, '09193333333');
    await retype(/^Email/, 'ana@example.com');
    await save();
    const notice = await screen.findByRole('alert', {
      name: 'Someone else saved changes to this patient while you were editing',
    });
    return { ...context, notice };
  }

  it('lists what the other person changed, before and now, marking what both changed', async () => {
    const { notice, sent, onSaved, state } = await collide();
    const items = within(notice)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(items).toEqual([
      expect.stringMatching(/^Sex: Female → Not recorded$/),
      expect.stringMatching(/^Birth date: May 1, 1990 → Not recorded$/),
      expect.stringMatching(/^Phone: \+63 917 111 1111 → \+63 918 222 2222.*You also changed this/),
      expect.stringMatching(/^City: Pasig → Makati$/),
    ]);
    expect(state.gets).toBe(2);
    // Nothing is saved on its own.
    expect(sent).toHaveLength(1);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('keeps what the person typed, and takes the new value for what they did not touch', async () => {
    await collide();
    expect(field(/^Phone/)).toHaveValue('09193333333');
    expect(field(/^Email/)).toHaveValue('ana@example.com');
    expect(field(/^City/)).toHaveValue('Makati');
    expect(screen.getByRole('radio', { name: 'Not recorded' })).toBeChecked();
    // The date the other person removed is gone from the boxes too.
    expect(screen.getByLabelText('Year')).toHaveValue('');
  });

  it('the next Save sends only the person’s own changes, with the new version', async () => {
    const { sent, onSaved } = await collide();
    await save();
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(sent[1]?.body).toEqual({ version: 4, phone: '09193333333', email: 'ana@example.com' });
  });

  it('says so when the record changed in a way the form does not show (archived meanwhile)', async () => {
    const context = setup({
      replies: [
        (state) => {
          state.record = patient({
            version: 4,
            archivedAt: '2026-01-31T20:00:00.000Z',
            archiveReason: 'Duplicate',
          });
          return errorBody(409, 'VERSION_CONFLICT');
        },
      ],
    });
    await ready();
    await retype(/^City/, 'Makati');
    await save();
    expect(await screen.findByText(/None of the fields below changed/)).toBeInTheDocument();
    expect(screen.getByText(/Archived on Feb 1, 2026: Duplicate/)).toBeInTheDocument();
    await save();
    await waitFor(() => {
      expect(context.sent[1]?.body).toEqual({ version: 4, city: 'Makati' });
    });
  });

  it('keeps the input and shows an error when the new record cannot be read', async () => {
    const { sent } = setup({ replies: [() => errorBody(409, 'VERSION_CONFLICT')] });
    await ready();
    await retype(/^City/, 'Makati');
    server.use(http.get(`${API}/patients/p1`, () => errorBody(500, 'INTERNAL_ERROR')));
    await save();
    expect(await screen.findByText(/req-e/)).toBeInTheDocument();
    expect(field(/^City/)).toHaveValue('Makati');
    expect(sent).toHaveLength(1);
  });

  it('has no accessibility violations with the notice', async () => {
    const { container } = await collide();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('EditPatientPage: another clinic, a missing patient', () => {
  it('keeps the form and the input when the clinic is switched elsewhere, and names both clinics', async () => {
    const { sent, queryClient } = setup({ replies: [() => errorBody(409, 'TENANT_MISMATCH')] });
    await ready();
    await retype(/^City/, 'Makati');
    // What the app does when another tab switches: the new clinic, an empty cache, and the patient
    // is "not found" there.
    server.use(http.get(`${API}/patients/p1`, () => errorBody(404, 'NOT_FOUND')));
    act(() => {
      signIn('clinic-b');
      queryClient.clear();
    });
    expect(field(/^City/)).toHaveValue('Makati');
    await save();
    await shows(
      'This page was opened for Sunrise Clinic. You are now working in Lakeside Clinic. Nothing was saved.',
    );
    expect(sent[0]?.tenant).toBe('clinic-a');
    expect(field(/^City/)).toHaveValue('Makati');
  });

  it('says it could not find an unknown or another clinic’s patient', async () => {
    setup();
    server.use(http.get(`${API}/patients/p1`, () => errorBody(404, 'NOT_FOUND')));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'We could not find this patient' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it('says the same when the patient is gone by the time of saving', async () => {
    setup({ replies: [() => errorBody(404, 'NOT_FOUND')] });
    await ready();
    await retype(/^City/, 'Makati');
    await save();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'We could not find this patient' }),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = setup();
    await ready();
    expect(await axe(container)).toHaveNoViolations();
  });
});
