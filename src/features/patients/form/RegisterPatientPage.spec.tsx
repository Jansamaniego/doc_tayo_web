import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore, type Membership } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { RegisterPatientPage } from './RegisterPatientPage.tsx';

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
  });
}
const created = {
  id: 'p9',
  patientNumber: 'P-000009',
  firstName: 'Ana',
  middleName: null,
  lastName: 'Cruz',
  suffix: null,
};
const errorBody = (status: number, code: string, details: unknown[] = [], headers = {}) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-n', details } },
    { status, headers },
  );

interface Sent {
  body: Record<string, unknown>;
  key: string | null;
  tenant: string | null;
}

/** POST /patients answers with each reply in turn (201 once they run out). */
function setup(...replies: (() => Response)[]) {
  const sent: Sent[] = [];
  let duplicateChecks = 0;
  server.use(
    http.get(`${API}/tenant`, () => HttpResponse.json({ data: { timezone: 'Asia/Manila' } })),
    http.get(`${API}/patients/possible-duplicates`, () => {
      duplicateChecks += 1;
      return HttpResponse.json({ data: [] });
    }),
    http.post(`${API}/patients`, async ({ request }) => {
      sent.push({
        body: (await request.json()) as Record<string, unknown>,
        key: request.headers.get('idempotency-key'),
        tenant: request.headers.get('x-expected-tenant-id'),
      });
      const reply = replies.shift();
      return reply ? reply() : HttpResponse.json({ data: created }, { status: 201 });
    }),
  );
  const onRegistered = vi.fn();
  const view = renderWithProviders(<RegisterPatientPage onRegistered={onRegistered} />);
  return { sent, onRegistered, duplicates: () => duplicateChecks, ...view };
}

const field = (label: RegExp) => screen.getByLabelText(label);
const fill = async (label: RegExp, text: string) => {
  await userEvent.click(field(label));
  await userEvent.paste(text);
};
const names = async () => {
  await fill(/^First name/, 'Ana');
  await fill(/^Last name/, 'Cruz');
};
const birth = async (month: string, day: string, year: string) => {
  await userEvent.selectOptions(screen.getByLabelText('Month'), month);
  await userEvent.type(screen.getByLabelText('Day'), day);
  await userEvent.type(screen.getByLabelText('Year'), year);
};
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Register patient' }));
const shows = async (text: string) => {
  expect(await screen.findAllByText(text)).not.toHaveLength(0);
};

beforeEach(() => {
  // 2026-03-01 20:00 UTC: today is 2 March in the clinic (Manila), 1 March where the specs run.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-01T20:00:00.000Z') });
  signIn();
});
afterEach(() => {
  vi.useRealTimers();
  sessionStore.set({ status: 'signed-out' });
});

describe('RegisterPatientPage: the form', () => {
  it('is titled without a name, starts empty, with sex not recorded and no birth date', () => {
    setup();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Register a patient' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Register a patient');
    expect(field(/^First name/)).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Not recorded' })).toBeChecked();
    expect(screen.getByLabelText('Year')).toHaveValue('');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/patients');
  });

  it('sends the trimmed fields only, with a key and the clinic, then tells the page', async () => {
    const { sent, onRegistered } = setup();
    await fill(/^First name/, '  Ana ');
    await fill(/^Last name/, 'Cruz');
    await userEvent.click(screen.getByRole('radio', { name: 'Female' }));
    await birth('May', '1', '1990');
    await fill(/^Phone/, '0917 123 4567');
    await fill(/^Allergies/, 'Penicillin');
    await submit();
    await waitFor(() => {
      expect(onRegistered).toHaveBeenCalledWith(expect.objectContaining({ id: 'p9' }));
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toEqual({
      firstName: 'Ana',
      lastName: 'Cruz',
      sex: 'female',
      birthDate: '1990-05-01',
      phone: '0917 123 4567',
      allergies: 'Penicillin',
    });
    expect(sent[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent[0]?.tenant).toBe('clinic-a');
  });

  it('requires both names, showing every problem at once', async () => {
    const { sent } = setup();
    await submit();
    await shows('Enter the first name.');
    await shows('Enter the last name.');
    expect(sent).toEqual([]);
  });

  it.each([
    [/^First name/, 80],
    [/^Middle name/, 80],
    [/^Last name/, 80],
    [/^Suffix/, 20],
    [/^Email/, 254],
    [/^Address/, 200],
    [/^City/, 120],
    [/^Province/, 120],
    [/^Guardian name/, 160],
    [/^Allergies/, 2000],
    [/^Front desk notes/, 2000],
  ] as const)('accepts %s at %d characters and refuses one more', async (label, limit) => {
    const { sent } = setup();
    await names();
    await userEvent.clear(field(label));
    await fill(label, 'x'.repeat(limit + 1));
    await submit();
    await shows(`This can have at most ${limit} characters.`);
    expect(sent).toEqual([]);
    await userEvent.clear(field(label));
    await fill(label, 'x'.repeat(limit));
    await submit();
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
  });

  it.each([
    ['December', '31', '1899'],
    ['March', '3', '2026'],
  ])(
    'refuses a birth date of %s %s, %s (before 1900, or after today in the clinic)',
    async (m, d, y) => {
      const { sent } = setup();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Register patient' })).toBeEnabled();
      });
      await names();
      await birth(m, d, y);
      await submit();
      await shows('Enter a birth date between Jan 1, 1900 and today.');
      expect(sent).toEqual([]);
    },
  );

  it.each([
    ['January', '1', '1900', '1900-01-01'],
    // Today in Manila, though still yesterday where the specs run.
    ['March', '2', '2026', '2026-03-02'],
  ])('accepts a birth date of %s %s, %s', async (m, d, y, iso) => {
    const { sent } = setup();
    await names();
    await birth(m, d, y);
    await submit();
    await waitFor(() => {
      expect(sent[0]?.body.birthDate).toBe(iso);
    });
  });

  it.each([
    ['a half-typed', async () => userEvent.type(screen.getByLabelText('Year'), '1990')],
    ['an impossible', async () => birth('February', '30', '2020')],
  ])('never silently drops %s birth date', async (_case, type) => {
    const { sent } = setup();
    await names();
    await type();
    await submit();
    await shows('Complete the birth date with a real date, or leave it empty.');
    expect(sent).toEqual([]);
  });

  it('lets the person fix a problem and register', async () => {
    const { sent } = setup();
    await submit();
    await shows('Enter the first name.');
    await names();
    await submit();
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
  });
});

describe('RegisterPatientPage: the server’s answers', () => {
  it('puts field problems under their fields and keeps what was typed', async () => {
    const { onRegistered } = setup(() =>
      errorBody(400, 'VALIDATION_FAILED', [
        { field: 'email', code: 'INVALID_FORMAT', message: 'bad' },
        { field: 'birthDate', code: 'OUT_OF_RANGE', message: 'bad' },
      ]),
    );
    await names();
    await fill(/^Email/, 'nope');
    await submit();
    await shows('This is not in the expected format.');
    await shows('This is outside the allowed range.');
    expect(field(/^Email/)).toHaveValue('nope');
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it.each(['phone', 'guardianPhone'])(
    'explains how to write a %s the API cannot read',
    async (name) => {
      setup(() =>
        errorBody(400, 'VALIDATION_FAILED', [
          { field: name, code: 'INVALID_FORMAT', message: 'x' },
        ]),
      );
      await names();
      await submit();
      await shows(
        'Enter a mobile number, or start a landline or foreign number with + and the country code.',
      );
    },
  );

  it('repeats the same key when pressed again after a lost connection, and makes a new one after a success', async () => {
    const { sent, onRegistered } = setup(() => HttpResponse.error());
    await names();
    await submit();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await submit();
    await waitFor(() => {
      expect(onRegistered).toHaveBeenCalledTimes(1);
    });
    await submit();
    await waitFor(() => {
      expect(sent).toHaveLength(3);
    });
    expect(sent[1]?.key).toBe(sent[0]?.key);
    expect(sent[2]?.key).not.toBe(sent[1]?.key);
  });

  it('while the first press is still running, waits and sends the same key again', async () => {
    const { sent, onRegistered } = setup(() =>
      errorBody(409, 'IDEMPOTENCY_KEY_IN_USE', [], { 'Retry-After': '1' }),
    );
    await names();
    await submit();
    await waitFor(
      () => {
        expect(onRegistered).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000 },
    );
    expect(sent).toHaveLength(2);
    expect(sent[1]?.key).toBe(sent[0]?.key);
  });

  it('when the patient may already be registered (the key was used), keeps the input, checks again and only starts anew when asked', async () => {
    const { sent, onRegistered, duplicates } = setup(() =>
      errorBody(422, 'IDEMPOTENCY_KEY_REUSED'),
    );
    await names();
    await fill(/^Phone/, '09171234567');
    await waitFor(() => {
      expect(duplicates()).toBe(1);
    });
    await submit();
    await shows(
      'This patient may already have been registered. Check the matching records before registering again.',
    );
    await waitFor(() => {
      expect(duplicates()).toBe(2);
    });
    expect(field(/^First name/)).toHaveValue('Ana');
    expect(screen.queryByRole('button', { name: 'Register patient' })).not.toBeInTheDocument();
    expect(sent).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Register as a new patient' }));
    await waitFor(() => {
      expect(onRegistered).toHaveBeenCalledTimes(1);
    });
    expect(sent[1]?.key).not.toBe(sent[0]?.key);
  });

  it('keeps sending the clinic the form was opened in, and names both clinics when it was switched', async () => {
    const { sent, onRegistered } = setup(() => errorBody(409, 'TENANT_MISMATCH'));
    await names();
    act(() => {
      signIn('clinic-b');
    });
    await submit();
    await shows(
      'This page was opened for Sunrise Clinic. You are now working in Lakeside Clinic. Nothing was saved.',
    );
    expect(sent[0]?.tenant).toBe('clinic-a');
    expect(field(/^First name/)).toHaveValue('Ana');
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it('shows any other failure with its request id', async () => {
    setup(() => errorBody(500, 'INTERNAL_ERROR'));
    await names();
    await submit();
    expect(await screen.findByText(/req-n/)).toBeInTheDocument();
  });
});

describe('RegisterPatientPage: accessibility', () => {
  it('has no violations, empty and with errors', async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
    await submit();
    await shows('Enter the first name.');
    expect(await axe(container)).toHaveNoViolations();
  });
});
