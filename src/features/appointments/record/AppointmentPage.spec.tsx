import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { appointmentAnswer } from '@/test/appointments.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { AppointmentPage } from './AppointmentPage.tsx';

const API = 'http://localhost:3000/api/v1';
const MAIN = 'a0000000-0000-4000-8000-000000000001';

function signIn(permissions = ['appointments.read', 'patients.read', 'directory.read']) {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me' },
    memberships: [],
    activeTenantId: 'clinic-a',
    permissions,
    platformRole: 'none',
    practitionerProfileId: null,
  });
}

function serve({
  appointment = appointmentAnswer(),
  timezone = null,
}: { appointment?: ReturnType<typeof appointmentAnswer>; timezone?: string | null } = {}) {
  server.use(
    http.get(`${API}/appointments/ap1`, () => HttpResponse.json({ data: appointment })),
    http.get(`${API}/branches/${MAIN}`, () =>
      HttpResponse.json({ data: { id: MAIN, name: 'Main', timezone, isActive: true } }),
    ),
    http.get(`${API}/tenant`, () => HttpResponse.json({ data: { timezone: 'Asia/Manila' } })),
  );
}

/** The text shown beside a label in the details list. */
const detail = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
const render = () => renderWithProviders(<AppointmentPage appointmentId="ap1" />);
const heading = () => screen.findByRole('heading', { level: 1, name: 'Appointment' });
const ready = () => screen.findByText('Main');

beforeEach(() => {
  signIn();
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('AppointmentPage', () => {
  it('shows every part of a booked appointment, in the branch’s time', async () => {
    serve();
    const { container } = render();
    await heading();
    await ready();
    expect(detail('Status')).toBe('Scheduled');
    expect(detail('Kind')).toBe('Booked time');
    expect(detail('Date')).toBe('Mon, Dec 7, 2026');
    expect(detail('Starts')).toBe('9:00 AM');
    expect(detail('Ends')).toBe('9:30 AM');
    expect(detail('Patient')).toBe('P-000001 · Dela Cruz, Juan');
    expect(detail('Practitioner')).toBe('Dr. Dan Doctor, MD');
    expect(detail('Service')).toBe('Follow-up');
    expect(detail('Purpose of visit')).toBe('Annual check-up');
    expect(detail('Checked in')).toBe('Not checked in');
    expect(screen.queryByText(/Cancelled on/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Times are in/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dela Cruz, Juan' })).toHaveAttribute(
      'href',
      '/patients/p1',
    );
    expect(screen.getByRole('link', { name: 'Dr. Dan Doctor, MD' })).toHaveAttribute(
      'href',
      '/practitioners/pr1',
    );
    expect(screen.getByRole('link', { name: 'All appointments' })).toHaveAttribute(
      'href',
      `/appointments?branch=${MAIN}&date=2026-12-07`,
    );
    expect(document.title).toBe('Appointment');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows a walk-in’s end as an estimate, and when the patient arrived', async () => {
    serve({
      appointment: appointmentAnswer({
        kind: 'walk_in',
        status: 'checked_in',
        checkedInAt: '2026-12-07T01:00:00.000Z',
        service: null,
        reason: null,
      }),
    });
    render();
    await ready();
    expect(detail('Kind')).toBe('Walk-in');
    expect(detail('Ends')).toBe('About 9:30 AM');
    expect(detail('Service')).toBe('No service');
    expect(detail('Purpose of visit')).toBe('Not given');
    expect(detail('Checked in')).toBe('Dec 7, 2026 at 9:00 AM');
  });

  it('says when and why it was cancelled', async () => {
    serve({
      appointment: appointmentAnswer({
        status: 'cancelled',
        cancelledAt: '2026-12-06T07:10:00.000Z',
        cancelReason: 'Patient called to cancel',
      }),
    });
    render();
    await ready();
    expect(detail('Status')).toBe('Cancelled');
    expect(
      screen.getByText('Cancelled on Dec 6, 2026 at 3:10 PM: Patient called to cancel'),
    ).toBeInTheDocument();
  });

  it('shows times in the branch’s own zone, says so, and says when the end is the next day', async () => {
    serve({
      timezone: 'Pacific/Honolulu',
      appointment: appointmentAnswer({
        startsAt: '2026-12-07T09:30:00.000Z',
        endsAt: '2026-12-07T10:30:00.000Z',
      }),
    });
    render();
    await ready();
    expect(detail('Date')).toBe('Sun, Dec 6, 2026');
    expect(detail('Starts')).toBe('11:30 PM');
    expect(detail('Ends')).toBe('12:30 AM (next day)');
    expect(screen.getByText('Times are in Pacific/Honolulu.')).toBeInTheDocument();
  });

  it('shows names without links to someone who may not open them', async () => {
    signIn(['appointments.read']);
    serve();
    render();
    await ready();
    expect(screen.queryByRole('link', { name: 'Dela Cruz, Juan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dr. Dan Doctor, MD' })).not.toBeInTheDocument();
    expect(detail('Practitioner')).toBe('Dr. Dan Doctor, MD');
  });

  it.each([
    [404, 'NOT_FOUND'],
    [400, 'VALIDATION_FAILED'],
  ])(
    'says it could not find an unknown or another clinic’s appointment (%i)',
    async (status, code) => {
      server.use(
        http.get(`${API}/appointments/ap1`, () =>
          HttpResponse.json({ error: { status, code, message: 'No', requestId: 'r' } }, { status }),
        ),
      );
      const { container } = render();
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: 'We could not find this appointment',
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'All appointments' })).toHaveAttribute(
        'href',
        '/appointments',
      );
      expect(await axe(container)).toHaveNoViolations();
    },
  );

  it('shows another failure with its request id', async () => {
    server.use(
      http.get(`${API}/appointments/ap1`, () =>
        HttpResponse.json(
          { error: { status: 500, code: 'INTERNAL_ERROR', message: 'No', requestId: 'req-1' } },
          { status: 500 },
        ),
      ),
    );
    render();
    expect(await screen.findByText('Reference: req-1')).toBeInTheDocument();
  });

  it('never shows a time while the branch’s zone is unknown', async () => {
    serve();
    server.use(
      http.get(`${API}/branches/${MAIN}`, () =>
        HttpResponse.json(
          { error: { status: 500, code: 'INTERNAL_ERROR', message: 'No', requestId: 'req-z' } },
          { status: 500 },
        ),
      ),
    );
    render();
    expect(await screen.findByText('Reference: req-z')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d:\d{2} (AM|PM)/);
  });
});
