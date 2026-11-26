import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore, type Membership } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { ArchiveDialog } from './ArchiveDialog.tsx';

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
    permissions: ['patients.read', 'patients.manage'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
}
const patient = {
  id: 'p1',
  patientNumber: 'P-000001',
  firstName: 'Ana',
  middleName: null,
  lastName: 'Cruz',
  suffix: null,
  version: 3,
} as Parameters<typeof ArchiveDialog>[0]['patient'];
const errorBody = (status: number, code: string, details: unknown[] = []) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-a', details } },
    { status },
  );

function setup(reply?: () => Response) {
  const sent: { body: unknown; tenant: string | null }[] = [];
  server.use(
    http.post(`${API}/patients/p1/archive`, async ({ request }) => {
      sent.push({
        body: await request.json(),
        tenant: request.headers.get('x-expected-tenant-id'),
      });
      return reply ? reply() : HttpResponse.json({ data: patient });
    }),
  );
  const handlers = { onClose: vi.fn(), onArchived: vi.fn(), onStale: vi.fn() };
  const view = renderWithProviders(<ArchiveDialog patient={patient} {...handlers} />);
  return { sent, ...handlers, ...view };
}
const reason = () => screen.getByLabelText('Reason');
const confirm = () => userEvent.click(screen.getByRole('button', { name: 'Archive patient' }));
const shows = async (text: string) => {
  expect(await screen.findAllByText(text)).not.toHaveLength(0);
};

beforeEach(() => {
  signIn();
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('ArchiveDialog', () => {
  it('names the patient, says what archiving does, and starts on Cancel', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Archive Ana Cruz?' });
    expect(dialog).toHaveTextContent('Patients are never deleted');
    expect(dialog).toHaveTextContent('For staff only, for example Duplicate record');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('sends the trimmed reason with the version, in the clinic it was opened in', async () => {
    const { sent, onArchived } = setup();
    await userEvent.type(reason(), '  Duplicate record  ');
    await confirm();
    await waitFor(() => {
      expect(onArchived).toHaveBeenCalled();
    });
    expect(sent).toEqual([
      { body: { reason: 'Duplicate record', version: 3 }, tenant: 'clinic-a' },
    ]);
  });

  it('requires a reason', async () => {
    const { sent } = setup();
    await userEvent.type(reason(), '   ');
    await confirm();
    await shows('Say why this patient is archived.');
    expect(sent).toEqual([]);
  });

  it('accepts 200 characters and refuses 201', async () => {
    const { sent } = setup();
    await userEvent.click(reason());
    await userEvent.paste('x'.repeat(201));
    await confirm();
    await shows('A reason can have at most 200 characters.');
    expect(sent).toEqual([]);
    await userEvent.clear(reason());
    await userEvent.paste('x'.repeat(200));
    await confirm();
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
  });

  it('lets the person add the reason and archive after a refusal', async () => {
    const { sent } = setup();
    await confirm();
    await shows('Say why this patient is archived.');
    await userEvent.type(reason(), 'Moved away');
    await confirm();
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
  });

  it('puts the API’s problem under the reason and keeps what was typed', async () => {
    const { onArchived } = setup(() =>
      errorBody(400, 'VALIDATION_FAILED', [{ field: 'reason', code: 'TOO_LONG', message: 'x' }]),
    );
    await userEvent.type(reason(), 'Moved away');
    await confirm();
    await shows('This is too long.');
    expect(reason()).toHaveValue('Moved away');
    expect(onArchived).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'CONFLICT'],
    [409, 'VERSION_CONFLICT'],
    [404, 'NOT_FOUND'],
  ])('hands %s %s to the page, which reads the patient again', async (status, code) => {
    const { onStale } = setup(() => errorBody(status, code));
    await userEvent.type(reason(), 'Moved away');
    await confirm();
    await waitFor(() => {
      expect(onStale).toHaveBeenCalledWith(expect.objectContaining({ code }));
    });
  });

  it('names both clinics when another one was chosen meanwhile, and keeps the reason', async () => {
    const { sent } = setup(() => {
      signIn('clinic-b');
      return errorBody(409, 'TENANT_MISMATCH');
    });
    await userEvent.type(reason(), 'Moved away');
    await confirm();
    await shows(
      'This page was opened for Sunrise Clinic. You are now working in Lakeside Clinic. Nothing was saved.',
    );
    expect(sent[0]?.tenant).toBe('clinic-a');
    expect(reason()).toHaveValue('Moved away');
  });

  it('shows any other failure with its request id', async () => {
    setup(() => errorBody(500, 'INTERNAL_ERROR'));
    await userEvent.type(reason(), 'Moved away');
    await confirm();
    expect(await screen.findByText(/req-a/)).toBeInTheDocument();
  });

  it('Cancel closes without sending; with a typed reason it asks first', async () => {
    const first = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(first.onClose).toHaveBeenCalled();
    expect(first.sent).toEqual([]);
    first.unmount();

    const second = setup();
    await userEvent.type(reason(), 'Moved');
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Leave without saving?');
    expect(second.onClose).not.toHaveBeenCalled();
  });

  it('has no accessibility violations, plain and with an error', async () => {
    setup();
    expect(await axe(document.body)).toHaveNoViolations();
    await confirm();
    await shows('Say why this patient is archived.');
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
