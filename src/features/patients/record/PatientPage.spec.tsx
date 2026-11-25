import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { PatientPage } from './PatientPage.tsx';

const API = 'http://localhost:3000/api/v1';
const patient = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  patientNumber: 'P-000123',
  firstName: 'Juan',
  middleName: 'Santos',
  lastName: 'Dela Cruz',
  suffix: 'Jr.',
  sex: 'male',
  birthDate: '1985-03-02',
  phone: '+639171234567',
  email: 'juan@example.com',
  addressLine: '12 Mabini St',
  city: 'Taguig',
  province: 'Metro Manila',
  guardianName: null,
  guardianPhone: null,
  allergies: 'Penicillin\nShellfish',
  notes: 'Prefers morning appointments',
  archivedAt: null,
  archiveReason: null,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});
const errorBody = (status: number, code: string) =>
  HttpResponse.json({ error: { status, code, message: 'x', requestId: 'req-r' } }, { status });

function signIn(tenantId = 'clinic-a') {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me Myself' },
    memberships: [],
    activeTenantId: tenantId,
    permissions: ['tenant.read', 'patients.read', 'patients.manage'],
    platformRole: 'none',
  });
}

const serve = (over: Record<string, unknown> = {}) => {
  server.use(
    http.get(`${API}/patients/p1`, () => HttpResponse.json({ data: patient(over) })),
    http.get(`${API}/tenant`, () => HttpResponse.json({ data: { timezone: 'Asia/Manila' } })),
  );
};

const render = (options: Parameters<typeof renderWithProviders>[1] = {}) =>
  renderWithProviders(<PatientPage patientId="p1" />, options);
const heading = () => screen.findByRole('heading', { level: 1, name: 'Juan Santos Dela Cruz Jr.' });
const section = (name: string) => screen.getByRole('region', { name });

beforeEach(() => {
  // 2026-03-01 20:00 UTC: already 2 March in Manila, still 1 March where the specs run (New York).
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-03-01T20:00:00.000Z') });
  signIn();
});
afterEach(() => {
  vi.useRealTimers();
  sessionStore.set({ status: 'signed-out' });
});

describe('PatientPage', () => {
  it('shows who the patient is: full name, number, sex, birth date and age in the clinic zone', async () => {
    serve();
    render();
    await heading();
    const summary = section('Patient summary');
    expect(summary).toHaveTextContent('P-000123');
    expect(summary).toHaveTextContent('Male');
    await waitFor(() => {
      expect(summary).toHaveTextContent('Mar 2, 1985 (41 years)');
    });
    expect(screen.getByRole('link', { name: 'All patients' })).toHaveAttribute('href', '/patients');
  });

  it.each([
    ['female', 'Female'],
    ['unknown', 'Not recorded'],
  ])('says sex %s as %s', async (sex, words) => {
    serve({ sex, birthDate: null });
    render();
    await heading();
    expect(section('Patient summary')).toHaveTextContent(words);
  });

  it('shows the contact details, with the phone grouped', async () => {
    serve();
    render();
    await heading();
    const contact = section('Contact');
    for (const text of [
      '+63 917 123 4567',
      'juan@example.com',
      '12 Mabini St',
      'Taguig',
      'Metro Manila',
    ]) {
      expect(contact).toHaveTextContent(text);
    }
  });

  it('says "Not recorded" for what is empty', async () => {
    serve({
      birthDate: null,
      phone: null,
      email: null,
      addressLine: null,
      city: null,
      province: null,
    });
    render();
    await heading();
    expect(within(section('Contact')).getAllByText('Not recorded')).toHaveLength(5);
    expect(section('Patient summary')).toHaveTextContent('Not recorded');
  });

  it('shows allergies first among the sections, keeping their lines, and says "None recorded" when empty', async () => {
    serve();
    const view = render();
    await heading();
    const allergies = section('Allergies');
    expect(allergies.textContent).toContain('Penicillin\nShellfish');
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles[0]).toBe('Allergies');
    view.unmount();

    serve({ allergies: null });
    render();
    await heading();
    expect(section('Allergies')).toHaveTextContent('None recorded');
  });

  it('labels the notes as not medical', async () => {
    serve();
    render();
    await heading();
    expect(section('Front desk notes (not medical)')).toHaveTextContent(
      'Prefers morning appointments',
    );
  });

  it('shows a guardian when there is one, with the phone grouped, even for an adult', async () => {
    serve({ guardianName: 'Carmen Reyes', guardianPhone: '+639181112222' });
    render();
    await heading();
    expect(section('Guardian')).toHaveTextContent('Carmen Reyes');
    expect(section('Guardian')).toHaveTextContent('+63 918 111 2222');
  });

  it.each([
    ['a 10 year old', '2016-01-01'],
    ['a baby', '2025-09-01'],
    ['someone who turns 18 tomorrow', '2008-03-03'],
  ])('says no guardian is recorded for %s', async (_who, birthDate) => {
    serve({ birthDate });
    render();
    await heading();
    await waitFor(() => {
      expect(section('Guardian')).toHaveTextContent('No guardian recorded');
    });
  });

  it.each([
    ['someone who turned 18 today (in the clinic zone)', '2008-03-02'],
    ['an adult', '1985-03-02'],
    ['someone with no birth date', null],
  ])('leaves the guardian section out for %s', async (_who, birthDate) => {
    serve({ birthDate });
    render();
    await heading();
    // Wait for the clinic's zone (the age shows), so the absence is not just "not known yet".
    await waitFor(() => {
      expect(section('Patient summary')).toHaveTextContent(birthDate ? 'years' : 'Not recorded');
    });
    expect(screen.queryByRole('region', { name: 'Guardian' })).not.toBeInTheDocument();
  });

  it('shows an archived patient with a banner saying when (in the clinic zone) and why', async () => {
    serve({ archivedAt: '2026-01-31T20:00:00.000Z', archiveReason: 'Duplicate record' });
    render();
    await heading();
    await waitFor(() => {
      expect(screen.getByText(/Archived on Feb 1, 2026: Duplicate record/)).toBeInTheDocument();
    });
  });

  it('has no archived banner for an active patient', async () => {
    serve();
    render();
    await heading();
    expect(screen.queryByText(/Archived on/)).not.toBeInTheDocument();
  });

  it('offers Edit to a person who may manage patients', async () => {
    serve();
    render();
    await heading();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/patients/p1/edit');
  });

  it('offers no Edit without patients.manage', async () => {
    const state = sessionStore.get();
    if (state.status === 'signed-in') {
      sessionStore.set({ ...state, permissions: ['tenant.read', 'patients.read'] });
    }
    serve();
    render();
    await heading();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('copies the patient number', async () => {
    serve();
    const user = userEvent.setup();
    render();
    await heading();
    await user.click(screen.getByRole('button', { name: 'Copy number' }));
    expect(await navigator.clipboard.readText()).toBe('P-000123');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('never puts the patient’s name in the browser tab title', async () => {
    serve();
    render();
    await heading();
    expect(document.title).toBe('Patient record');
  });

  it.each([
    [404, 'NOT_FOUND'],
    [400, 'VALIDATION_FAILED'],
  ])(
    '%s %s (an unknown id, another clinic’s patient or a broken link) says we could not find the patient',
    async (status, code) => {
      serve();
      server.use(http.get(`${API}/patients/p1`, () => errorBody(status, code)));
      render();
      expect(
        await screen.findByRole('heading', { level: 1, name: 'We could not find this patient' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'All patients' })).toHaveAttribute(
        'href',
        '/patients',
      );
    },
  );

  it('shows another error with its request id and tries again', async () => {
    let failing = true;
    serve();
    server.use(
      http.get(`${API}/patients/p1`, () =>
        failing ? errorBody(500, 'INTERNAL_ERROR') : HttpResponse.json({ data: patient() }),
      ),
    );
    render();
    expect(await screen.findByText(/req-r/)).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await heading()).toBeInTheDocument();
  });

  it('never shows one clinic’s patient after the clinic changes', async () => {
    serve();
    server.use(
      http.get(`${API}/patients/p1`, () => {
        const state = sessionStore.get();
        return state.status === 'signed-in' && state.activeTenantId === 'clinic-b'
          ? errorBody(404, 'NOT_FOUND')
          : HttpResponse.json({ data: patient() });
      }),
    );
    render();
    await heading();
    act(() => {
      signIn('clinic-b');
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'We could not find this patient' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Dela Cruz/)).not.toBeInTheDocument();
  });

  it('keeps no patient in memory once the page is closed', async () => {
    serve();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render({ queryClient });
    await heading();
    const cached = () =>
      queryClient.getQueryCache().findAll({ queryKey: ['clinic-a', 'patients'] });
    expect(cached()).toHaveLength(1);
    view.unmount();
    await waitFor(() => {
      expect(cached()).toHaveLength(0);
    });
  });

  it('has no accessibility violations, for an active and an archived child', async () => {
    serve({
      birthDate: '2016-01-01',
      archivedAt: '2026-01-01T00:00:00.000Z',
      archiveReason: 'Moved away',
    });
    const { container } = render();
    await heading();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('PatientPage: archive and restore', () => {
  const archivedFields = {
    archivedAt: '2026-01-31T20:00:00.000Z',
    archiveReason: 'Duplicate record',
    version: 2,
  };
  const errorFor = (code: string) =>
    HttpResponse.json(
      { error: { status: 409, code, message: 'x', requestId: 'req-z' } },
      { status: 409 },
    );
  /** A fake record that the actions change. */
  function fake(start: Record<string, unknown> = {}) {
    const state = {
      record: patient(start) as Record<string, unknown>,
      gets: 0,
      bodies: [] as unknown[],
    };
    serve();
    server.use(
      http.get(`${API}/patients/p1`, () => {
        state.gets += 1;
        return HttpResponse.json({ data: state.record });
      }),
    );
    return state;
  }
  const buttonNames = () => screen.queryAllByRole('button').map((button) => button.textContent);

  it('offers Archive for an active patient, and Restore instead for an archived one', async () => {
    fake();
    const view = render();
    await heading();
    expect(buttonNames()).toEqual(['Copy number', 'Archive']);
    view.unmount();
    fake(archivedFields);
    render();
    await heading();
    expect(buttonNames()).toEqual(['Copy number', 'Restore']);
    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument();
  });

  it('offers neither without patients.manage', async () => {
    const session = sessionStore.get();
    if (session.status === 'signed-in') {
      sessionStore.set({ ...session, permissions: ['tenant.read', 'patients.read'] });
    }
    fake(archivedFields);
    render();
    await heading();
    expect(buttonNames()).toEqual(['Copy number']);
  });

  it('archiving shows the banner, closes the dialog and offers Restore', async () => {
    const state = fake();
    server.use(
      http.post(`${API}/patients/p1/archive`, async ({ request }) => {
        state.bodies.push(await request.json());
        state.record = patient(archivedFields);
        return HttpResponse.json({ data: state.record });
      }),
    );
    render();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await userEvent.type(await screen.findByLabelText('Reason'), 'Duplicate record');
    await userEvent.click(screen.getByRole('button', { name: 'Archive patient' }));
    expect(
      await screen.findByText(/Archived on Feb 1, 2026: Duplicate record/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(state.bodies).toEqual([{ reason: 'Duplicate record', version: 1 }]);
  });

  it('restoring asks first, then sends the version and removes the banner', async () => {
    const state = fake(archivedFields);
    server.use(
      http.post(`${API}/patients/p1/unarchive`, async ({ request }) => {
        state.bodies.push(await request.json());
        state.record = patient({ version: 3 });
        return HttpResponse.json({ data: state.record });
      }),
    );
    render();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Restore Juan Santos Dela Cruz Jr.?');
    expect(dialog).toHaveTextContent('They will appear in the patient list and in search again.');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(state.bodies).toEqual([]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));
    await waitFor(() => {
      expect(screen.queryByText(/Archived on/)).not.toBeInTheDocument();
    });
    expect(state.bodies).toEqual([{ version: 2 }]);
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
  });

  it.each([
    ['CONFLICT', 'This patient was already archived or restored by someone else.'],
    ['VERSION_CONFLICT', 'Someone else changed this patient. Check the record, then try again.'],
  ])(
    '%s while archiving closes the dialog, reads the patient again and says why',
    async (code, text) => {
      const state = fake();
      server.use(
        http.post(`${API}/patients/p1/archive`, () => {
          state.record = patient(archivedFields);
          return errorFor(code);
        }),
      );
      render();
      await heading();
      await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
      await userEvent.type(await screen.findByLabelText('Reason'), 'Moved');
      await userEvent.click(screen.getByRole('button', { name: 'Archive patient' }));
      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument();
      expect(state.gets).toBeGreaterThan(1);
    },
  );

  it.each([
    ['CONFLICT', 'This patient was already archived or restored by someone else.'],
    ['VERSION_CONFLICT', 'Someone else changed this patient. Check the record, then try again.'],
  ])('%s while restoring reads the patient again and says why', async (code, text) => {
    const state = fake(archivedFields);
    server.use(
      http.post(`${API}/patients/p1/unarchive`, () => {
        state.record = patient({ version: 5 });
        return errorFor(code);
      }),
    );
    render();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Restore' }),
    );
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Archive' })).toBeInTheDocument();
  });

  it('shows another restore failure with its request id', async () => {
    fake(archivedFields);
    server.use(
      http.post(`${API}/patients/p1/unarchive`, () =>
        HttpResponse.json(
          { error: { status: 500, code: 'INTERNAL_ERROR', message: 'x', requestId: 'req-z' } },
          { status: 500 },
        ),
      ),
    );
    render();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Restore' }),
    );
    expect(await screen.findByText(/req-z/)).toBeInTheDocument();
  });
});
