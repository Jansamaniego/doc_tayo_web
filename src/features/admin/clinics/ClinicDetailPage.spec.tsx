import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { ClinicDetailPage } from './ClinicDetailPage.tsx';

const API = 'http://localhost:3000/api/v1';
const detail = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Bayview Clinic',
  slug: 'bayview-clinic',
  status: 'active',
  timezone: 'Asia/Manila',
  createdAt: '2026-11-20T17:00:00.000Z',
  memberCount: 4,
  owners: [{ userId: 'u1', fullName: 'Dr. Maria Santos', email: 'maria@bayview.example' }],
  ...over,
});
const serveDetail = (status = 'active', over: Record<string, unknown> = {}): void => {
  server.use(
    http.get(`${API}/admin/tenants/c1`, () =>
      HttpResponse.json({ data: detail({ status, ...over }) }),
    ),
  );
};
const errorBody = (status: number, code: string) =>
  HttpResponse.json({ error: { status, code, message: 'x', requestId: 'req-5' } }, { status });

function renderDetail(onMissing = vi.fn()) {
  renderWithProviders(<ClinicDetailPage tenantId="c1" onMissing={onMissing} />);
  return onMissing;
}

describe('ClinicDetailPage', () => {
  it('shows the clinic, its owners and the date in its own time zone', async () => {
    serveDetail();
    renderDetail();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bayview Clinic' }),
    ).toBeInTheDocument();
    const page = document.body;
    expect(page).toHaveTextContent('bayview-clinic');
    expect(page).toHaveTextContent('Active');
    expect(page).toHaveTextContent('Nov 21, 2026');
    expect(page).toHaveTextContent('Asia/Manila');
    expect(page).toHaveTextContent('Dr. Maria Santos');
    expect(page).toHaveTextContent('maria@bayview.example');
    expect(page).toHaveTextContent('4');
  });

  it('offers only Suspend and Deactivate for an active clinic', async () => {
    serveDetail('active');
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument();
  });

  it('offers Reactivate and Deactivate for a suspended clinic', async () => {
    serveDetail('suspended');
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();
  });

  it('offers nothing for a deactivated clinic and says why', async () => {
    serveDetail('deactivated');
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    expect(
      screen.queryByRole('button', { name: /Suspend|Reactivate|Deactivate/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/permanent/i)).toBeInTheDocument();
  });

  it('suspends after a confirmation that says what happens, then shows the new status', async () => {
    serveDetail('active');
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${API}/admin/tenants/c1/status`, async ({ request }) => {
        bodies.push(await request.json());
        serveDetail('suspended');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      'Everyone at Bayview Clinic loses access until you reactivate it',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    expect(bodies).toEqual([{ status: 'suspended' }]);
  });

  it('does nothing when the confirmation is cancelled', async () => {
    serveDetail('active');
    const sent = vi.fn();
    server.use(
      http.patch(`${API}/admin/tenants/c1/status`, () => {
        sent();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(sent).not.toHaveBeenCalled();
  });

  it('deactivates only after typing the slug, and says it cannot be undone', async () => {
    serveDetail('active');
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${API}/admin/tenants/c1/status`, async ({ request }) => {
        bodies.push(await request.json());
        serveDetail('deactivated');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('This cannot be undone.');
    const confirm = within(dialog).getByRole('button', { name: 'Deactivate' });
    await userEvent.click(confirm);
    expect(bodies).toEqual([]);
    await userEvent.type(
      within(dialog).getByLabelText('Type bayview-clinic to confirm'),
      'bayview-clinic',
    );
    await userEvent.click(confirm);
    await waitFor(() => {
      expect(bodies).toEqual([{ status: 'deactivated' }]);
    });
    expect(await screen.findByText(/permanent/i)).toBeInTheDocument();
  });

  it('reloads the clinic and explains when someone else changed it first (409)', async () => {
    serveDetail('active');
    server.use(
      http.patch(`${API}/admin/tenants/c1/status`, () => {
        serveDetail('suspended');
        return errorBody(409, 'CONFLICT');
      }),
    );
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Suspend' }),
    );
    expect(await screen.findByText(/changed by someone else/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  });

  it('goes back to the list when the clinic does not exist (404)', async () => {
    server.use(http.get(`${API}/admin/tenants/c1`, () => errorBody(404, 'NOT_FOUND')));
    const onMissing = renderDetail();
    await waitFor(() => {
      expect(onMissing).toHaveBeenCalledTimes(1);
    });
  });

  it('shows other failures with the request id and a way to try again', async () => {
    server.use(http.get(`${API}/admin/tenants/c1`, () => errorBody(503, 'SERVICE_UNAVAILABLE')));
    renderDetail();
    expect(await screen.findByText(/req-5/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('does not offer to edit what the API cannot edit', async () => {
    serveDetail('active');
    renderDetail();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: /Edit|Resend|Staff/ })).not.toBeInTheDocument();
    expect(screen.getByText(/the clinic's owner signs in and edits them/)).toBeInTheDocument();
  });

  it('has no accessibility violations, with and without the dialog', async () => {
    serveDetail('active');
    const { container } = renderWithProviders(
      <ClinicDetailPage tenantId="c1" onMissing={() => undefined} />,
    );
    await screen.findByRole('heading', { level: 1 });
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await screen.findByRole('alertdialog');
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
