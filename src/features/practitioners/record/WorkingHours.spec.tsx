import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { WorkingHours } from './WorkingHours.tsx';

const API = 'http://localhost:3000/api/v1';
const BRANCHES = [
  { id: 'b-main', name: 'Main', timeZone: 'Asia/Manila' },
  { id: 'b-hi', name: 'Hawaii', timeZone: 'Pacific/Honolulu' },
];

interface Interval {
  startsAt: string;
  endsAt: string;
}

function serve(intervals: Interval[] = [], timeZone = 'Asia/Manila') {
  const requests: URL[] = [];
  server.use(
    http.get(`${API}/practitioners/pr1/availability`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      return HttpResponse.json({
        data: { date: url.searchParams.get('date'), timeZone, intervals },
      });
    }),
  );
  return requests;
}
const render = ({
  branches = BRANCHES,
  isActive = true,
}: { branches?: typeof BRANCHES; isActive?: boolean } = {}) =>
  renderWithProviders(<WorkingHours profileId="pr1" branches={branches} isActive={isActive} />);
const last = (requests: URL[]) => requests.at(-1)?.searchParams;

beforeEach(() => {
  // 2026-03-01 20:00 UTC: 2 March in Manila, 1 March in Honolulu and in New York (the runner).
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-01T20:00:00.000Z') });
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me' },
    memberships: [],
    activeTenantId: 'clinic-a',
    permissions: ['directory.read'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
});
afterEach(() => {
  vi.useRealTimers();
  sessionStore.set({ status: 'signed-out' });
});

describe('WorkingHours (the working hours of one day, not free appointment slots)', () => {
  it('starts on today in the branch’s zone, whatever the computer thinks', async () => {
    const requests = serve();
    render();
    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    expect(last(requests)?.get('branchId')).toBe('b-main');
    expect(last(requests)?.get('date')).toBe('2026-03-02');
    expect(screen.getByLabelText('Day')).toHaveValue('2');
  });

  it('moves to today in the other branch’s zone when the branch changes', async () => {
    const requests = serve();
    render();
    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    await userEvent.selectOptions(screen.getByLabelText('Branch'), 'Hawaii');
    await waitFor(() => {
      expect(last(requests)?.get('date')).toBe('2026-03-01');
    });
    expect(last(requests)?.get('branchId')).toBe('b-hi');
  });

  it('keeps a day the person chose when the branch changes', async () => {
    const requests = serve();
    render();
    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    await userEvent.clear(screen.getByLabelText('Day'));
    await userEvent.type(screen.getByLabelText('Day'), '15');
    await waitFor(() => {
      expect(last(requests)?.get('date')).toBe('2026-03-15');
    });
    await userEvent.selectOptions(screen.getByLabelText('Branch'), 'Hawaii');
    await waitFor(() => {
      expect(last(requests)?.get('branchId')).toBe('b-hi');
    });
    expect(last(requests)?.get('date')).toBe('2026-03-15');
  });

  it('asks for nothing while the day is incomplete, and says to choose one', async () => {
    const requests = serve();
    render();
    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    await userEvent.clear(screen.getByLabelText('Year'));
    expect(await screen.findByText('Choose a day.')).toBeInTheDocument();
    expect(requests).toHaveLength(1);
  });

  it('shows the intervals in the zone of the answer, and that appointments are not counted', async () => {
    serve(
      [
        { startsAt: '2026-03-02T01:00:00.000Z', endsAt: '2026-03-02T04:00:00.000Z' },
        // Ends at midnight of the branch's day.
        { startsAt: '2026-03-02T12:00:00.000Z', endsAt: '2026-03-02T16:00:00.000Z' },
      ],
      'Asia/Manila',
    );
    render();
    expect(await screen.findByText('9:00 AM – 12:00 PM')).toBeInTheDocument();
    expect(screen.getByText('8:00 PM – midnight')).toBeInTheDocument();
    expect(screen.getByText('Times are in Asia/Manila.')).toBeInTheDocument();
    expect(screen.getByText('Booked appointments are not counted yet.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/free|available slot/i);
  });

  it('says there are no working hours on the day', async () => {
    serve([]);
    render();
    expect(await screen.findByText('No working hours on this day')).toBeInTheDocument();
  });

  it('says an inactive practitioner has no hours, asking for nothing', () => {
    // An unexpected request fails the test.
    render({ isActive: false });
    expect(
      screen.getByText('No working hours: this practitioner is inactive.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Branch')).not.toBeInTheDocument();
  });

  it('says there is no branch to look at', () => {
    render({ branches: [] });
    expect(screen.getByText('There is no branch to show hours for.')).toBeInTheDocument();
  });

  it('shows a failure with its request id and tries again', async () => {
    let failing = true;
    server.use(
      http.get(`${API}/practitioners/pr1/availability`, () =>
        failing
          ? HttpResponse.json(
              { error: { status: 500, code: 'INTERNAL_ERROR', message: 'x', requestId: 'req-h' } },
              { status: 500 },
            )
          : HttpResponse.json({
              data: { date: '2026-03-02', timeZone: 'Asia/Manila', intervals: [] },
            }),
      ),
    );
    render();
    expect(await screen.findByText(/req-h/)).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No working hours on this day')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    serve([{ startsAt: '2026-03-02T01:00:00.000Z', endsAt: '2026-03-02T04:00:00.000Z' }]);
    const { container } = render();
    await screen.findByText('9:00 AM – 12:00 PM');
    expect(await axe(container)).toHaveNoViolations();
  });
});
