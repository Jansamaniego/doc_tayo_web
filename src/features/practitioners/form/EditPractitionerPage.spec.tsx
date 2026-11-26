import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore, type Membership } from '@/api/session/session-store.ts';
import { fakeController } from '@/test/fake-session.tsx';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { EditPractitionerPage } from './EditPractitionerPage.tsx';

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
const profile = {
  id: 'pr1',
  membershipId: 'm1',
  displayName: 'Dr. Ana Cruz, MD',
  specialization: 'Pediatrics',
  prcLicenseNumber: '123',
  ptrNumber: null,
  isActive: true,
  schedule: [],
};
const errorBody = (status: number, code: string, details: unknown[] = []) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-ep', details } },
    { status },
  );

function setup(reply?: () => Response) {
  const sent: { body: unknown; tenant: string | null }[] = [];
  server.use(
    http.get(`${API}/practitioners/pr1`, () => HttpResponse.json({ data: profile })),
    http.patch(`${API}/practitioners/pr1`, async ({ request }) => {
      sent.push({
        body: await request.json(),
        tenant: request.headers.get('x-expected-tenant-id'),
      });
      return reply ? reply() : HttpResponse.json({ data: profile });
    }),
  );
  const onSaved = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = renderWithProviders(<EditPractitionerPage profileId="pr1" onSaved={onSaved} />, {
    queryClient,
    controller: fakeController(),
  });
  return { sent, onSaved, queryClient, ...view };
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
  signIn();
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('EditPractitionerPage', () => {
  it('starts filled, with the title and a way back, and no Person field', async () => {
    setup();
    await ready();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Edit practitioner' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Edit practitioner');
    expect(field(/^Display name/)).toHaveValue('Dr. Ana Cruz, MD');
    expect(field(/^PTR number/)).toHaveValue('');
    expect(screen.queryByRole('combobox', { name: /Person/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/practitioners/pr1',
    );
  });

  it('sends only the changed fields in the opened clinic, then confirms', async () => {
    const { sent, onSaved } = setup();
    await ready();
    await retype(/^Specialization/, '');
    await retype(/^PTR number/, 'P-1');
    await save();
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(sent).toEqual([
      { body: { specialization: null, ptrNumber: 'P-1' }, tenant: 'clinic-a' },
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

  it('refuses an emptied display name, and one over 160 characters', async () => {
    const { sent } = setup();
    await ready();
    await retype(/^Display name/, '');
    await save();
    await shows('Enter how the name is printed.');
    await userEvent.click(field(/^Display name/));
    await userEvent.paste('x'.repeat(161));
    await save();
    await shows('This can have at most 160 characters.');
    expect(sent).toEqual([]);
  });

  it('shows the API’s field problem and keeps what was typed', async () => {
    setup(() =>
      errorBody(400, 'VALIDATION_FAILED', [{ field: 'ptrNumber', code: 'TOO_LONG', message: 'x' }]),
    );
    await ready();
    await retype(/^PTR number/, 'P-2');
    await save();
    await shows('This is too long.');
    expect(field(/^PTR number/)).toHaveValue('P-2');
  });

  it('keeps the form and what was typed when the clinic is switched elsewhere', async () => {
    const { queryClient } = setup(() => errorBody(409, 'TENANT_MISMATCH'));
    await ready();
    await retype(/^PTR number/, 'P-3');
    server.use(http.get(`${API}/practitioners/pr1`, () => errorBody(404, 'NOT_FOUND')));
    act(() => {
      signIn('clinic-b');
      queryClient.clear();
    });
    await save();
    await shows(
      'This page was opened for Sunrise Clinic. You are now working in Lakeside Clinic. Nothing was saved.',
    );
    expect(field(/^PTR number/)).toHaveValue('P-3');
  });

  it('says it could not find an unknown or another clinic’s practitioner', async () => {
    setup();
    server.use(http.get(`${API}/practitioners/pr1`, () => errorBody(404, 'NOT_FOUND')));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'We could not find this practitioner' }),
    ).toBeInTheDocument();
  });

  it('says the same when the profile is gone by the time of saving', async () => {
    setup(() => errorBody(404, 'NOT_FOUND'));
    await ready();
    await retype(/^PTR number/, 'P-4');
    await save();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'We could not find this practitioner' }),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = setup();
    await ready();
    expect(await axe(container)).toHaveNoViolations();
  });
});
