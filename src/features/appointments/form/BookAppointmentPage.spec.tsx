import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore, type Membership } from '@/api/session/session-store.ts';
import { notify } from '@/design-system/components/toast.tsx';
import { appointmentAnswer } from '@/test/appointments.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { BookAppointmentPage, type BookingPrefill } from './BookAppointmentPage.tsx';

const API = 'http://localhost:3000/api/v1';
const MAIN = 'a0000000-0000-4000-8000-000000000001';
const ANNEX = 'a0000000-0000-4000-8000-000000000002';
const JUAN = 'c0000000-0000-4000-8000-000000000001';
const ALL = [
  'appointments.read',
  'appointments.manage',
  'patients.read',
  'patients.manage',
  'directory.read',
  'services.read',
];
const clinic = (tenantId: string, tenantName: string): Membership => ({
  tenantId,
  tenantName,
  tenantStatus: 'active',
  membershipStatus: 'active',
  roles: [],
});
function signIn({ permissions = ALL, activeTenantId = 'clinic-a' } = {}) {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me' },
    memberships: [clinic('clinic-a', 'Sunrise Clinic'), clinic('clinic-b', 'Lakeside Clinic')],
    activeTenantId,
    permissions,
    platformRole: 'none',
    practitionerProfileId: null,
  });
}

const patient = (id: string, firstName: string, lastName: string, number: string) => ({
  id,
  patientNumber: number,
  firstName,
  middleName: null,
  lastName,
  suffix: null,
  birthDate: '1980-03-04',
  archivedAt: null,
});
const juan = patient(JUAN, 'Juan', 'Dela Cruz', 'P-000001');
const JUAN_OPTION = 'P-000001, Dela Cruz, Juan, born Mar 4, 1980';

const member = (n: number, name: string) => ({
  membershipId: `m${n}`,
  fullName: name,
  jobTitle: null,
  roles: [],
  practitioner: {
    profileId: `pr${n}`,
    displayName: name,
    specialization: null,
    isActive: true,
  },
});
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

/** Serves every picker. `POST /appointments` answers with each reply in turn (201 once they run out). */
function setup({
  prefill = {},
  replies = [],
  patients = [juan],
  branches = [
    { id: MAIN, name: 'Main', timezone: null, isActive: true },
    { id: ANNEX, name: 'Annex', timezone: null, isActive: true },
  ],
}: {
  prefill?: BookingPrefill;
  replies?: (() => Response | Promise<Response>)[];
  patients?: ReturnType<typeof patient>[];
  branches?: { id: string; name: string; timezone: string | null; isActive: boolean }[];
} = {}) {
  const sent: Sent[] = [];
  const asked = {
    directory: [] as URL[],
    patients: [] as { url: URL; tenant: string | null }[],
    services: [] as URL[],
    hours: [] as URL[],
    branches: 0,
  };
  const page = <Item,>(data: Item[]) => ({
    data,
    meta: { page: 1, pageSize: 100, totalItems: data.length, totalPages: data.length ? 1 : 0 },
  });
  server.use(
    http.get(`${API}/branches`, () => {
      asked.branches += 1;
      return HttpResponse.json(page(branches));
    }),
    http.get(`${API}/tenant`, () => HttpResponse.json({ data: { timezone: 'Asia/Manila' } })),
    http.get(`${API}/directory`, ({ request }) => {
      const url = new URL(request.url);
      asked.directory.push(url);
      const everyone = [member(1, 'Dr. Ana Reyes'), member(2, 'Dr. Ben Lim')];
      const here = url.searchParams.get('branchId') === MAIN ? [everyone[1]] : [];
      return HttpResponse.json(page(url.searchParams.has('branchId') ? here : everyone));
    }),
    http.get(`${API}/services`, ({ request }) => {
      asked.services.push(new URL(request.url));
      return HttpResponse.json(
        page([
          { id: 's1', name: 'Follow-up', defaultDurationMinutes: 15, isActive: true },
          { id: 's2', name: 'Procedure', defaultDurationMinutes: 90, isActive: true },
        ]),
      );
    }),
    http.get(`${API}/patients`, ({ request }) => {
      asked.patients.push({
        url: new URL(request.url),
        tenant: request.headers.get('x-expected-tenant-id'),
      });
      return HttpResponse.json(page(patients));
    }),
    http.get(`${API}/patients/${JUAN}`, () => HttpResponse.json({ data: juan })),
    http.get(`${API}/practitioners/:profileId/availability`, ({ request }) => {
      const url = new URL(request.url);
      asked.hours.push(url);
      return HttpResponse.json({
        data: {
          date: url.searchParams.get('date'),
          timeZone: 'Asia/Manila',
          intervals: [{ startsAt: '2026-12-07T01:30:00.000Z', endsAt: '2026-12-07T04:00:00.000Z' }],
        },
      });
    }),
    http.post(`${API}/appointments`, async ({ request }) => {
      sent.push({
        body: (await request.json()) as Record<string, unknown>,
        key: request.headers.get('idempotency-key'),
        tenant: request.headers.get('x-expected-tenant-id'),
      });
      const reply = replies.shift();
      return reply ? reply() : HttpResponse.json({ data: appointmentAnswer() }, { status: 201 });
    }),
  );
  const onBooked = vi.fn();
  const view = renderWithProviders(<BookAppointmentPage prefill={prefill} onBooked={onBooked} />);
  return { sent, asked, onBooked, ...view };
}

const group = (name: RegExp) => within(screen.getByRole('group', { name }));
const ready = () => screen.findByRole('combobox', { name: 'Practitioner' });
const choosePractitioner = async (name = 'Dr. Ben Lim') => {
  const select = await ready();
  await within(select).findByRole('option', { name });
  await userEvent.selectOptions(select, name);
};
const chooseService = async (name: string) => {
  const select = screen.getByRole('combobox', { name: 'Service' });
  await within(select).findByRole('option', { name });
  await userEvent.selectOptions(select, name);
};
const choosePatient = async () => {
  await userEvent.click(screen.getByRole('combobox', { name: /^Patient/ }));
  await userEvent.click(await screen.findByRole('option', { name: JUAN_OPTION }));
};
const setTime = async (field: RegExp, hour: string, minute: string, period: string) => {
  await userEvent.selectOptions(group(field).getByLabelText('Hour'), hour);
  await userEvent.selectOptions(group(field).getByLabelText('Minute'), minute);
  await userEvent.selectOptions(group(field).getByLabelText('AM or PM'), period);
};
const timeShown = (field: RegExp) =>
  ['Hour', 'Minute', 'AM or PM']
    .map((part) => group(field).getByLabelText<HTMLSelectElement>(part).value)
    .join(' ');
const complete = async () => {
  await ready();
  await choosePatient();
  await choosePractitioner();
  await chooseService('Follow-up');
  await setTime(/^Start/, '9', '00', 'AM');
};
const book = () => userEvent.click(screen.getByRole('button', { name: 'Book appointment' }));
const sentTimes = async (sent: Sent[], count: number) => {
  await waitFor(() => {
    expect(sent).toHaveLength(count);
  });
};
const shows = async (text: string) => {
  expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
};

beforeEach(() => {
  // 00:30 on 7 December in Manila; still 6 December in New York (the runner).
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-12-06T16:30:00.000Z') });
  window.localStorage.clear();
  notify.clear();
  signIn();
});
afterEach(() => {
  vi.useRealTimers();
  sessionStore.set({ status: 'signed-out' });
});

describe('BookAppointmentPage: the form', () => {
  it('starts as a booked time on today at the first branch', async () => {
    const { container, asked } = setup();
    await ready();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Book an appointment' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Book an appointment');
    expect(screen.getByRole('radio', { name: 'Booked time' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Branch' })).toHaveValue(MAIN);
    expect(group(/^Date/).getByLabelText('Day')).toHaveValue('7');
    expect(screen.getByRole('combobox', { name: 'Service' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /Purpose of visit/ })).toHaveAccessibleDescription(
      /Not symptoms: every staff member can read this\./,
    );
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `/appointments?branch=${MAIN}&date=2026-12-07`,
    );
    expect(asked.services[0]?.searchParams.get('pageSize')).toBe('100');
    expect(asked.services[0]?.searchParams.has('includeInactive')).toBe(false);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('hides the times for a walk-in and names the button after it', async () => {
    setup();
    await ready();
    await userEvent.click(screen.getByRole('radio', { name: 'Walk-in (here now)' }));
    expect(screen.queryByRole('group', { name: /^Start/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Date/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Free working hours')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check in walk-in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book appointment' })).not.toBeInTheDocument();
  });

  it('fills the branch, day, patient and kind from the address', async () => {
    setup({ prefill: { branch: ANNEX, date: '2026-12-20', patient: JUAN } });
    await ready();
    expect(screen.getByRole('combobox', { name: 'Branch' })).toHaveValue(ANNEX);
    expect(group(/^Date/).getByLabelText('Day')).toHaveValue('20');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /^Patient/ })).toHaveTextContent(JUAN_OPTION);
    });
  });

  it('starts as a walk-in when the address says so', async () => {
    setup({ prefill: { kind: 'walk_in' } });
    await ready();
    expect(screen.getByRole('radio', { name: 'Walk-in (here now)' })).toBeChecked();
  });

  it('uses today for a day in the address that has passed', async () => {
    setup({ prefill: { date: '2026-12-01' } });
    await ready();
    expect(group(/^Date/).getByLabelText('Day')).toHaveValue('7');
  });

  it('says to add a branch when there is no active one', async () => {
    setup({ branches: [] });
    expect(
      await screen.findByText('Add an active branch before booking appointments.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book appointment' })).not.toBeInTheDocument();
  });
});

describe('BookAppointmentPage: the pickers', () => {
  it('searches patients on the server after a pause, never archived ones', async () => {
    const { asked } = setup();
    await ready();
    await userEvent.click(screen.getByRole('combobox', { name: /^Patient/ }));
    await screen.findByRole('option', { name: JUAN_OPTION });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'dela');
    await waitFor(() => {
      expect(asked.patients.at(-1)?.url.searchParams.get('q')).toBe('dela');
    });
    const queries = asked.patients.map(({ url }) => url.searchParams.get('q'));
    // One request when it opens, one after the typing stops.
    expect(queries).toEqual([null, 'dela']);
    for (const { url, tenant } of asked.patients) {
      expect(url.searchParams.get('pageSize')).toBe('20');
      expect(url.searchParams.has('includeArchived')).toBe(false);
      expect(tenant).toBe('clinic-a');
    }
    expect(window.location.href).not.toContain('dela');
  });

  it('offers to register someone who is not found', async () => {
    setup({ patients: [] });
    await ready();
    await userEvent.click(screen.getByRole('combobox', { name: /^Patient/ }));
    expect(await screen.findByText('No patient found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register a patient' })).toHaveAttribute(
      'href',
      '/patients/new',
    );
  });

  it('offers no registration to someone who may not register', async () => {
    signIn({ permissions: ALL.filter((key) => key !== 'patients.manage') });
    setup({ patients: [] });
    await ready();
    await userEvent.click(screen.getByRole('combobox', { name: /^Patient/ }));
    expect(await screen.findByText('No patient found')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Register a patient' })).not.toBeInTheDocument();
  });

  it('lists the practitioners who work at the branch first, and still offers the others', async () => {
    const { asked } = setup();
    const select = await ready();
    await waitFor(() => {
      expect(
        within(select)
          .getAllByRole('group')
          .map((part) => [
            part.getAttribute('label'),
            within(part)
              .getAllByRole('option')
              .map((option) => option.textContent),
          ]),
      ).toEqual([
        ['Works at Main', ['Dr. Ben Lim']],
        ['Other practitioners', ['Dr. Ana Reyes']],
      ]);
    });
    expect(
      asked.directory.every((url) => url.searchParams.get('practitionersOnly') === 'true'),
    ).toBe(true);
  });

  it('shows the free working hours, and a press fills the start', async () => {
    const { asked } = setup();
    await ready();
    expect(screen.queryByText('Free working hours')).not.toBeInTheDocument();
    await choosePractitioner();
    const free = await screen.findByRole('button', { name: '9:30 AM – 12:00 PM' });
    expect(screen.getByText('Booking outside these hours is allowed.')).toBeInTheDocument();
    expect(asked.hours.at(-1)?.pathname).toContain('/practitioners/pr2/');
    expect(asked.hours.at(-1)?.searchParams.get('branchId')).toBe(MAIN);
    expect(asked.hours.at(-1)?.searchParams.get('date')).toBe('2026-12-07');
    await userEvent.click(free);
    expect(timeShown(/^Start/)).toBe('9 30 AM');
    expect(timeShown(/^End/)).toBe('10 00 AM');
  });

  it('says when there are no free working hours', async () => {
    setup();
    server.use(
      http.get(`${API}/practitioners/:profileId/availability`, () =>
        HttpResponse.json({
          data: { date: '2026-12-07', timeZone: 'Asia/Manila', intervals: [] },
        }),
      ),
    );
    await ready();
    await choosePractitioner();
    expect(await screen.findByText('No free working hours on this day')).toBeInTheDocument();
  });

  it('proposes the end from the service until the end is typed', async () => {
    setup();
    await ready();
    await setTime(/^Start/, '9', '00', 'AM');
    expect(timeShown(/^End/)).toBe('9 30 AM');
    expect(screen.getByText('Length: 30 minutes')).toBeInTheDocument();
    await chooseService('Procedure');
    expect(timeShown(/^End/)).toBe('10 30 AM');
    expect(screen.getByText('Length: 1 hour 30 minutes')).toBeInTheDocument();
    await userEvent.selectOptions(group(/^End/).getByLabelText('Hour'), '11');
    await chooseService('Follow-up');
    expect(timeShown(/^End/)).toBe('11 30 AM');
  });

  it('asks whether an end before the start is on the next day', async () => {
    setup();
    await ready();
    expect(screen.queryByRole('checkbox', { name: 'Ends the next day' })).not.toBeInTheDocument();
    await setTime(/^Start/, '11', '45', 'PM');
    // The proposed end crosses midnight, so it is the next day already.
    expect(screen.getByRole('checkbox', { name: 'Ends the next day' })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ends the next day' }));
    expect(screen.getByRole('checkbox', { name: 'Ends the next day' })).not.toBeChecked();
  });

  it.each([
    ['patients.read', 'You cannot see patients, so you cannot book here.'],
    ['directory.read', 'You cannot see practitioners, so you cannot book here.'],
    ['services.read', 'You cannot see services, so you cannot book here.'],
  ])('without %s says why booking is not possible, asking for none of it', async (key, reason) => {
    signIn({ permissions: ALL.filter((permission) => permission !== key) });
    const { asked } = setup();
    expect(await screen.findByText(reason)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book appointment' })).not.toBeInTheDocument();
    const calls = {
      'patients.read': asked.patients,
      'directory.read': asked.directory,
      'services.read': asked.services,
    }[key];
    expect(calls).toEqual([]);
  });
});

describe('BookAppointmentPage: booking', () => {
  it('sends the booking with a key and the clinic, confirms and opens it', async () => {
    const { sent, onBooked } = setup();
    await complete();
    await userEvent.type(screen.getByRole('textbox', { name: /Purpose of visit/ }), 'Lab results');
    await book();
    await waitFor(() => {
      expect(onBooked).toHaveBeenCalledWith(
        expect.objectContaining({ id: appointmentAnswer().id }),
      );
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toEqual({
      kind: 'scheduled',
      branchId: MAIN,
      patientId: JUAN,
      practitionerMembershipId: 'm2',
      serviceId: 's1',
      startsAt: '2026-12-07T01:00:00.000Z',
      endsAt: '2026-12-07T01:15:00.000Z',
      reason: 'Lab results',
    });
    expect(sent[0]?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent[0]?.tenant).toBe('clinic-a');
  });

  it('checks in a walk-in without times', async () => {
    const walkIn = () =>
      HttpResponse.json(
        { data: appointmentAnswer({ kind: 'walk_in', status: 'checked_in' }) },
        { status: 201 },
      );
    const { sent, onBooked } = setup({ prefill: { kind: 'walk_in' }, replies: [walkIn] });
    await ready();
    await choosePatient();
    await choosePractitioner();
    await userEvent.click(screen.getByRole('button', { name: 'Check in walk-in' }));
    await waitFor(() => {
      expect(onBooked).toHaveBeenCalled();
    });
    expect(sent[0]?.body).toEqual({
      kind: 'walk_in',
      branchId: MAIN,
      patientId: JUAN,
      practitionerMembershipId: 'm2',
      serviceId: null,
      reason: null,
    });
  });

  it('shows every problem at once and sends nothing', async () => {
    const { sent } = setup();
    await ready();
    await book();
    await shows('Choose the patient.');
    await shows('Choose the practitioner.');
    await shows('Enter the start time.');
    expect(sent).toEqual([]);
  });

  it('sends one request for a double press', async () => {
    let release: () => void = () => undefined;
    const held = () =>
      new Promise<Response>((resolve) => {
        release = () => {
          resolve(HttpResponse.json({ data: appointmentAnswer() }, { status: 201 }));
        };
      });
    const { sent, onBooked } = setup({ replies: [held] });
    await complete();
    await book();
    await sentTimes(sent, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    act(() => {
      release();
    });
    await waitFor(() => {
      expect(onBooked).toHaveBeenCalledTimes(1);
    });
    expect(sent).toHaveLength(1);
  });

  it('reuses the key to retry the same booking, and takes a new one once it changes', async () => {
    const { sent } = setup({
      replies: [() => HttpResponse.error(), () => errorBody(409, 'APPOINTMENT_OVERLAP')],
    });
    await complete();
    await book();
    await shows('We could not connect. Check your internet connection and try again.');
    await book();
    await sentTimes(sent, 2);
    expect(sent[1]?.key).toBe(sent[0]?.key);
    await shows(
      'The practitioner already has an appointment at that time. Choose another time or practitioner.',
    );
    await setTime(/^Start/, '10', '00', 'AM');
    await book();
    await sentTimes(sent, 3);
    expect(sent[2]?.key).not.toBe(sent[0]?.key);
  });

  it('keeps everything for a taken time and reads the free hours again', async () => {
    const { asked } = setup({ replies: [() => errorBody(409, 'APPOINTMENT_OVERLAP')] });
    await complete();
    await screen.findByRole('button', { name: '9:30 AM – 12:00 PM' });
    const before = asked.hours.length;
    await book();
    await shows(
      'The practitioner already has an appointment at that time. Choose another time or practitioner.',
    );
    await waitFor(() => {
      expect(asked.hours.length).toBeGreaterThan(before);
    });
    expect(screen.getByRole('combobox', { name: /^Patient/ })).toHaveTextContent(JUAN_OPTION);
    expect(screen.getByRole('combobox', { name: 'Practitioner' })).toHaveValue('m2');
    expect(timeShown(/^Start/)).toBe('9 00 AM');
  });

  it('links to an archived patient', async () => {
    setup({ replies: [() => errorBody(409, 'PATIENT_ARCHIVED')] });
    await complete();
    await book();
    await shows('This patient record is archived.');
    expect(screen.getByRole('link', { name: 'Open the patient record' })).toHaveAttribute(
      'href',
      `/patients/${JUAN}`,
    );
  });

  it('says under the field that a practitioner can no longer be booked, and reads the list again', async () => {
    const { asked } = setup({ replies: [() => errorBody(422, 'NOT_A_PRACTITIONER')] });
    await complete();
    const before = asked.directory.length;
    await book();
    await shows('This practitioner can no longer be booked.');
    const select = screen.getByRole('combobox', { name: 'Practitioner' });
    expect(select).toHaveAccessibleDescription(/can no longer be booked/);
    expect(select).toHaveValue('');
    await waitFor(() => {
      expect(asked.directory.length).toBeGreaterThan(before);
    });
  });

  it.each([
    ['branchId', 'Branch', 'This branch is no longer active.'],
    ['serviceId', 'Service', 'This service is no longer offered.'],
  ])('clears a refused %s, says why under it and reads it again', async (field, label, message) => {
    const { asked } = setup({
      replies: [
        () => errorBody(400, 'VALIDATION_FAILED', [{ field, code: 'INVALID_VALUE', message: 'x' }]),
      ],
    });
    await complete();
    const reads = () => (field === 'branchId' ? asked.branches : asked.services.length);
    const before = reads();
    await book();
    await shows(message);
    expect(screen.getByRole('combobox', { name: label })).toHaveAccessibleDescription(
      new RegExp(message.replace('.', '\\.')),
    );
    expect(screen.getByRole('combobox', { name: label })).toHaveValue('');
    await waitFor(() => {
      expect(reads()).toBeGreaterThan(before);
    });
  });

  it('puts the API’s complaints about the times under their fields', async () => {
    setup({
      replies: [
        () =>
          errorBody(400, 'VALIDATION_FAILED', [
            { field: 'startsAt', code: 'OUT_OF_RANGE', message: 'x' },
          ]),
      ],
    });
    await complete();
    await book();
    await shows('This is outside the allowed range.');
    expect(group(/^Start/).getByLabelText('Hour')).toHaveAccessibleDescription(
      /outside the allowed range/,
    );
  });

  it('says that something chosen is gone, and reads every picker again', async () => {
    const { asked } = setup({ replies: [() => errorBody(404, 'NOT_FOUND')] });
    await complete();
    const before = [asked.branches, asked.directory.length, asked.services.length];
    await book();
    await shows('Something you chose is no longer available.');
    await waitFor(() => {
      expect(asked.branches).toBeGreaterThan(before[0] ?? 0);
      expect(asked.directory.length).toBeGreaterThan(before[1] ?? 0);
      expect(asked.services.length).toBeGreaterThan(before[2] ?? 0);
    });
  });

  it('shows another failure with its request id and keeps the form', async () => {
    setup({ replies: [() => errorBody(500, 'INTERNAL_ERROR')] });
    await complete();
    await book();
    expect(await screen.findByText('Reference: req-n')).toBeInTheDocument();
    expect(timeShown(/^Start/)).toBe('9 00 AM');
  });

  it('keeps the form, and its clinic, when another clinic is chosen in another tab', async () => {
    const { sent } = setup({ replies: [() => errorBody(409, 'TENANT_MISMATCH')] });
    await complete();
    server.use(
      http.get(`${API}/branches`, () =>
        HttpResponse.json({
          data: [{ id: 'other', name: 'Lakeside Main', timezone: null, isActive: true }],
          meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
        }),
      ),
      http.get(`${API}/directory`, () =>
        HttpResponse.json({
          data: [],
          meta: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 },
        }),
      ),
    );
    act(() => {
      signIn({ activeTenantId: 'clinic-b' });
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole('combobox', { name: 'Branch' })).toHaveValue(MAIN);
    expect(screen.queryByText('Lakeside Main')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Practitioner' })).toHaveValue('m2');
    expect(screen.getByRole('combobox', { name: /^Patient/ })).toHaveTextContent(JUAN_OPTION);
    await book();
    await shows(
      'This page was opened for Sunrise Clinic. You are now working in Lakeside Clinic. Nothing was saved.',
    );
    expect(sent[0]?.tenant).toBe('clinic-a');
  });

  it('shows nothing of the other clinic’s failures after such a switch', async () => {
    setup();
    await complete();
    await screen.findByRole('button', { name: '9:30 AM – 12:00 PM' });
    const gone = () => errorBody(404, 'NOT_FOUND');
    server.use(
      http.get(`${API}/branches`, gone),
      http.get(`${API}/tenant`, gone),
      http.get(`${API}/directory`, gone),
      http.get(`${API}/services`, gone),
      http.get(`${API}/practitioners/:profileId/availability`, gone),
    );
    act(() => {
      signIn({ activeTenantId: 'clinic-b' });
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Free working hours')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Practitioner' })).toHaveValue('m2');
    expect(screen.getByRole('combobox', { name: 'Service' })).toHaveValue('s1');
  });
});
