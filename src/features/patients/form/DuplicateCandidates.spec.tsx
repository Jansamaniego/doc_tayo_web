import { screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { DuplicateCandidates, type DuplicateQuery } from './DuplicateCandidates.tsx';

const API = 'http://localhost:3000/api/v1';
const EMPTY: DuplicateQuery = { firstName: '', lastName: '', birthDate: '', phone: '' };
const candidate = (reason: string, over: Record<string, unknown> = {}) => ({
  reason,
  patient: {
    id: 'p2',
    patientNumber: 'P-000002',
    firstName: 'Maria',
    middleName: null,
    lastName: 'Santos',
    suffix: null,
    birthDate: '1990-05-01',
    phone: '+639181112222',
    archivedAt: null,
    ...over,
  },
});

function serve(data: unknown[] = []) {
  const requests: { url: URL; tenant: string | null }[] = [];
  server.use(
    http.get(`${API}/patients/possible-duplicates`, ({ request }) => {
      requests.push({
        url: new URL(request.url),
        tenant: request.headers.get('x-expected-tenant-id'),
      });
      return HttpResponse.json({ data });
    }),
  );
  return requests;
}
const pause = () => new Promise((resolve) => setTimeout(resolve, 450));
const render = (query: Partial<DuplicateQuery>) =>
  renderWithProviders(<DuplicateCandidates tenantId="clinic-a" query={{ ...EMPTY, ...query }} />);

beforeEach(() => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me' },
    memberships: [],
    activeTenantId: 'clinic-a',
    permissions: ['patients.read', 'patients.manage'],
    platformRole: 'none',
  });
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('DuplicateCandidates: when it asks', () => {
  it.each([
    ['nothing', {}],
    ['only a first name', { firstName: 'Maria' }],
    ['names without a birth date', { firstName: 'Maria', lastName: 'Santos' }],
    ['a birth date without both names', { lastName: 'Santos', birthDate: '1990-05-01' }],
    ['spaces for a phone', { phone: '   ' }],
  ])('asks nothing for %s', async (_case, query) => {
    // An unexpected request fails the test.
    render(query);
    await pause();
    expect(
      screen.queryByRole('region', { name: 'Is this the same person?' }),
    ).not.toBeInTheDocument();
  });

  it('asks with the names and birth date once they are all there', async () => {
    const requests = serve();
    render({ firstName: ' Maria ', lastName: 'Santos', birthDate: '1990-05-01' });
    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    const searchParams = new URL(requests[0]?.url ?? API).searchParams;
    expect(searchParams.get('firstName')).toBe('Maria');
    expect(searchParams.get('lastName')).toBe('Santos');
    expect(searchParams.get('birthDate')).toBe('1990-05-01');
    expect(searchParams.has('phone')).toBe(false);
  });

  it('asks with a phone alone, sending "+" encoded, in the clinic the form was opened in', async () => {
    const requests = serve();
    render({ phone: '+63 918 111 2222' });
    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    expect(requests[0]?.url.search).toContain('%2B63');
    expect(requests[0]?.url.searchParams.get('phone')).toBe('+63 918 111 2222');
    expect(requests[0]?.tenant).toBe('clinic-a');
  });

  it('asks once per pause, not on every key', async () => {
    const requests = serve();
    function Typing() {
      const [phone, setPhone] = useState('');
      return (
        <>
          <input
            aria-label="Phone"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
            }}
          />
          <DuplicateCandidates tenantId="clinic-a" query={{ ...EMPTY, phone }} />
        </>
      );
    }
    renderWithProviders(<Typing />);
    await userEvent.type(screen.getByLabelText('Phone'), '09181112222');
    await pause();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url.searchParams.get('phone')).toBe('09181112222');
  });
});

describe('DuplicateCandidates: what it shows', () => {
  const query = { phone: '09181112222' };

  it('lists the candidates with why they may be the same person, and a way to open each', async () => {
    serve([
      candidate('same_phone'),
      candidate('similar_name_same_birth_date', {
        id: 'p3',
        patientNumber: 'P-000003',
        middleName: 'Theresa',
        phone: null,
        archivedAt: '2026-01-01T00:00:00.000Z',
      }),
    ]);
    const { container } = render(query);
    const panel = await screen.findByRole('region', { name: 'Is this the same person?' });
    const [first, second] = within(panel).getAllByRole('listitem');
    expect(first).toHaveTextContent('Maria Santos');
    expect(first).toHaveTextContent('P-000002');
    expect(first).toHaveTextContent('May 1, 1990');
    expect(first).toHaveTextContent('+63 918 111 2222');
    expect(first).toHaveTextContent('Same phone number');
    expect(first).not.toHaveTextContent('Archived');
    expect(second).toHaveTextContent('Maria Theresa Santos');
    expect(second).toHaveTextContent('Similar name and the same birth date');
    expect(second).toHaveTextContent('Archived');
    expect(
      within(panel).getByRole('link', { name: 'Open record of Maria Santos' }),
    ).toHaveAttribute('href', '/patients/p2');
    expect(screen.getByText('2 possible matching records')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows nothing when there is no candidate', async () => {
    const requests = serve([]);
    render(query);
    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    expect(
      screen.queryByRole('region', { name: 'Is this the same person?' }),
    ).not.toBeInTheDocument();
  });

  it('shows nothing when the check fails: it never blocks registering', async () => {
    let asked = 0;
    server.use(
      http.get(`${API}/patients/possible-duplicates`, () => {
        asked += 1;
        return HttpResponse.json(
          { error: { status: 500, code: 'INTERNAL_ERROR', message: 'x', requestId: 'r' } },
          { status: 500 },
        );
      }),
    );
    render(query);
    await waitFor(() => {
      expect(asked).toBe(1);
    });
    await pause();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Is this the same person?' }),
    ).not.toBeInTheDocument();
  });

  it('asks again when told to', async () => {
    const requests = serve([]);
    function Again() {
      const [round, setRound] = useState(0);
      return (
        <>
          <button
            onClick={() => {
              setRound(round + 1);
            }}
          >
            again
          </button>
          <DuplicateCandidates tenantId="clinic-a" query={{ ...EMPTY, ...query }} round={round} />
        </>
      );
    }
    renderWithProviders(<Again />);
    await waitFor(() => {
      expect(requests).toHaveLength(1);
    });
    await userEvent.click(screen.getByRole('button', { name: 'again' }));
    await waitFor(() => {
      expect(requests).toHaveLength(2);
    });
  });
});
