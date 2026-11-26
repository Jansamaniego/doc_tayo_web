import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { PractitionerPage } from './PractitionerPage.tsx';

const API = 'http://localhost:3000/api/v1';
const MAIN = 'b-main';
const ANNEX = 'b-annex';
const block = (weekday: number, startsAt: string, endsAt: string, branchId = MAIN) => ({
  weekday,
  startsAt,
  endsAt,
  branchId,
});
const profile = (over: Record<string, unknown> = {}) => ({
  id: 'pr1',
  membershipId: 'm1',
  displayName: 'Dr. Dan Doctor, MD',
  specialization: 'Family Medicine',
  prcLicenseNumber: '0000001',
  ptrNumber: 'PTR-1',
  isActive: true,
  schedule: [
    block(1, '09:00', '12:00'),
    block(1, '13:00', '17:00', ANNEX),
    block(6, '20:00', '24:00'),
  ],
  ...over,
});
const branch = (id: string, name: string, timezone: string | null = null) => ({
  id,
  name,
  timezone,
  isActive: true,
});
const errorBody = (status: number, code: string) =>
  HttpResponse.json({ error: { status, code, message: 'x', requestId: 'req-pr' } }, { status });

function signIn(tenantId = 'clinic-a') {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me' },
    memberships: [],
    activeTenantId: tenantId,
    permissions: ['tenant.read', 'branches.read', 'directory.read'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
}

function serve({
  record = profile(),
  branches = [branch(MAIN, 'Main'), branch(ANNEX, 'Quezon City Annex')],
  directory = [
    {
      membershipId: 'm1',
      fullName: 'Dan Doctor',
      jobTitle: 'Physician',
      roles: [],
      practitioner: null,
    },
  ] as unknown[],
} = {}) {
  server.use(
    http.get(`${API}/practitioners/pr1`, () => HttpResponse.json({ data: record })),
    http.get(`${API}/practitioners/pr1/availability`, () =>
      HttpResponse.json({ data: { date: '2026-03-02', timeZone: 'Asia/Manila', intervals: [] } }),
    ),
    http.get(`${API}/branches`, () =>
      HttpResponse.json({
        data: branches,
        meta: { page: 1, pageSize: 100, totalItems: branches.length, totalPages: 1 },
      }),
    ),
    http.get(`${API}/directory`, () =>
      HttpResponse.json({
        data: directory,
        meta: { page: 1, pageSize: 100, totalItems: directory.length, totalPages: 1 },
      }),
    ),
    http.get(`${API}/tenant`, () => HttpResponse.json({ data: { timezone: 'Asia/Manila' } })),
  );
}
const render = () => renderWithProviders(<PractitionerPage profileId="pr1" />);
const heading = () => screen.findByRole('heading', { level: 1, name: 'Dr. Dan Doctor, MD' });
const week = () => screen.getByRole('region', { name: 'Weekly schedule' });
const dayRow = (day: string): HTMLElement => {
  const row = within(week()).getByText(day, { selector: 'dt' }).parentElement;
  if (!row) throw new Error(`No row for ${day}`);
  return row;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-01T20:00:00.000Z') });
  signIn();
});
afterEach(() => {
  vi.useRealTimers();
  sessionStore.set({ status: 'signed-out' });
});

describe('PractitionerPage: the profile', () => {
  it('shows the display name, specialization, numbers and the staff member', async () => {
    serve();
    render();
    await heading();
    const page = document.body;
    for (const text of ['Family Medicine', '0000001', 'PTR-1']) {
      expect(page).toHaveTextContent(text);
    }
    await waitFor(() => {
      expect(page).toHaveTextContent('Dan Doctor · Physician');
    });
    expect(document.title).toBe('Dr. Dan Doctor, MD');
    expect(screen.getByRole('link', { name: 'All practitioners' })).toHaveAttribute(
      'href',
      '/practitioners',
    );
    expect(screen.queryByText(/inactive/i)).not.toBeInTheDocument();
  });

  it('says "Not recorded" for what is empty', async () => {
    serve({
      record: profile({ specialization: null, prcLicenseNumber: null, ptrNumber: null }),
    });
    render();
    await heading();
    expect(screen.getAllByText('Not recorded')).toHaveLength(3);
  });

  it('says when the person is not active staff at the moment', async () => {
    serve({ directory: [] });
    render();
    await heading();
    expect(await screen.findByText('Not active staff at the moment')).toBeInTheDocument();
  });

  it('shows a banner for a deactivated profile', async () => {
    serve({ record: profile({ isActive: false }) });
    render();
    await heading();
    expect(screen.getByText('This practitioner is inactive.')).toBeInTheDocument();
  });

  it('offers no changes to a person who cannot manage practitioners', async () => {
    serve();
    render();
    await heading();
    expect(screen.queryByRole('link', { name: 'Edit profile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit weekly schedule' })).not.toBeInTheDocument();
  });

  it('offers Edit profile and Deactivate to a manager', async () => {
    const session = sessionStore.get();
    if (session.status === 'signed-in') {
      sessionStore.set({ ...session, permissions: ['directory.read', 'practitioners.manage'] });
    }
    serve();
    render();
    await heading();
    expect(screen.getByRole('link', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(within(week()).getByRole('link', { name: 'Edit weekly schedule' })).toHaveAttribute(
      'href',
      '/practitioners/pr1/schedule',
    );
  });
});

describe('PractitionerPage: the weekly schedule', () => {
  it('lists Monday to Sunday with 12-hour times and the branch, and "No hours" for empty days', async () => {
    serve();
    render();
    await heading();
    await waitFor(() => {
      expect(week()).toHaveTextContent('Quezon City Annex');
    });
    expect(
      within(week())
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(dayRow('Monday')).toHaveTextContent('9:00 AM – 12:00 PM, Main');
    expect(dayRow('Monday')).toHaveTextContent('1:00 PM – 5:00 PM, Quezon City Annex');
    // A screen reader hears words.
    expect(dayRow('Monday')).toHaveTextContent('9:00 AM to 12:00 PM at Main');
    expect(dayRow('Tuesday')).toHaveTextContent('No hours');
    expect(dayRow('Saturday')).toHaveTextContent('8:00 PM – midnight, Main');
  });

  it('names a branch’s time zone only when it differs from the clinic’s', async () => {
    serve({
      branches: [
        branch(MAIN, 'Main', 'Asia/Manila'),
        branch(ANNEX, 'Quezon City Annex', 'Asia/Tokyo'),
      ],
    });
    render();
    await heading();
    await waitFor(() => {
      expect(dayRow('Monday')).toHaveTextContent('Quezon City Annex (Asia/Tokyo)');
    });
    expect(dayRow('Monday')).not.toHaveTextContent('Main (Asia/Manila)');
  });

  it('says there are no weekly hours yet for an empty week', async () => {
    serve({ record: profile({ schedule: [] }) });
    render();
    await heading();
    expect(week()).toHaveTextContent('No weekly hours yet');
  });

  it('keeps a block whose branch is unknown, saying so', async () => {
    serve({ branches: [] });
    render();
    await heading();
    await waitFor(() => {
      expect(dayRow('Monday')).toHaveTextContent('Unknown branch');
    });
  });
});

describe('PractitionerPage: failures', () => {
  it.each([
    [404, 'NOT_FOUND'],
    [400, 'VALIDATION_FAILED'],
  ])(
    '%s %s (unknown, another clinic’s or a broken link) says we could not find them',
    async (status, code) => {
      serve();
      server.use(http.get(`${API}/practitioners/pr1`, () => errorBody(status, code)));
      render();
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: 'We could not find this practitioner',
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'All practitioners' })).toBeInTheDocument();
    },
  );

  it('shows another failure with its request id and tries again', async () => {
    let failing = true;
    serve();
    server.use(
      http.get(`${API}/practitioners/pr1`, () =>
        failing ? errorBody(500, 'INTERNAL_ERROR') : HttpResponse.json({ data: profile() }),
      ),
    );
    render();
    expect(await screen.findByText(/req-pr/)).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await heading()).toBeInTheDocument();
  });

  it('never shows one clinic’s practitioner after the clinic changes', async () => {
    serve();
    server.use(
      http.get(`${API}/practitioners/pr1`, () => {
        const state = sessionStore.get();
        return state.status === 'signed-in' && state.activeTenantId === 'clinic-b'
          ? errorBody(404, 'NOT_FOUND')
          : HttpResponse.json({ data: profile() });
      }),
    );
    render();
    await heading();
    act(() => {
      signIn('clinic-b');
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'We could not find this practitioner' }),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations, active and inactive', async () => {
    serve({ record: profile({ isActive: false }) });
    const { container } = render();
    await heading();
    expect(await axe(container)).toHaveNoViolations();
  });
});
