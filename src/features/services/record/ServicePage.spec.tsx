import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { ServicePage } from './ServicePage.tsx';

const API = 'http://localhost:3000/api/v1';
const service = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  name: 'Follow-up',
  description: 'A second visit.',
  defaultDurationMinutes: 60,
  price: '300.00',
  currency: 'PHP',
  isActive: true,
  createdAt: '2026-11-27T00:00:00.000Z',
  updatedAt: '2026-11-27T00:00:00.000Z',
  ...over,
});
const errorBody = (status: number, code: string) =>
  HttpResponse.json({ error: { status, code, message: 'x', requestId: 'req-7' } }, { status });

const clinic = (tenantId: string, tenantName: string) => ({
  tenantId,
  tenantName,
  tenantStatus: 'active' as const,
  membershipStatus: 'active' as const,
  roles: [],
});

const signIn = (activeTenantId = 'clinic-a', permissions: string[] = []): void => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me Myself' },
    memberships: [clinic('clinic-a', 'Sunrise Clinic'), clinic('clinic-b', 'Lakeside Clinic')],
    activeTenantId,
    permissions: ['tenant.read', 'services.read', ...permissions],
    platformRole: 'none',
    practitionerProfileId: null,
  });
};
beforeEach(() => {
  signIn();
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

function serve(reply: () => Response) {
  server.use(http.get(`${API}/services/:serviceId`, () => reply()));
}
const found = (over: Record<string, unknown> = {}) => {
  serve(() => HttpResponse.json({ data: service(over) }));
};
const render = () => renderWithProviders(<ServicePage serviceId="s1" />);
const heading = (name: string) => screen.findByRole('heading', { level: 1, name });

/** The value shown beside a label. */
const detail = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;

describe('ServicePage', () => {
  it('shows the name, description, usual length and price, with a way back', async () => {
    found();
    render();
    expect(screen.getByText('Loading the service…')).toBeInTheDocument();
    expect(await heading('Follow-up')).toBeInTheDocument();
    expect(detail('Description')).toHaveTextContent('A second visit.');
    expect(detail('Usual length')).toHaveTextContent('1 hour');
    expect(detail('Price')).toHaveTextContent('₱300.00');
    expect(detail('Price')).toHaveTextContent('300 pesos');
    expect(screen.getByRole('link', { name: 'All services' })).toHaveAttribute(
      'href',
      '/clinic/services',
    );
    expect(
      screen.queryByText('This service is inactive.', { exact: false }),
    ).not.toBeInTheDocument();
    expect(document.title).toContain('Follow-up');
  });

  it.each([
    [null, 'Price at the desk'],
    ['0.00', 'Free'],
  ])('shows the price %s as "%s", and says when there is no description', async (price, text) => {
    found({ price, description: null });
    render();
    await heading('Follow-up');
    expect(detail('Price')).toHaveTextContent(text);
    expect(detail('Description')).toHaveTextContent('No description');
  });

  it('marks an inactive service, which a reader can still open', async () => {
    found({ isActive: false });
    render();
    await heading('Follow-up');
    expect(
      screen.getByText('This service is inactive. It is not offered when booking.'),
    ).toBeInTheDocument();
  });

  it('gives a reader no controls', async () => {
    found();
    render();
    await heading('Follow-up');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    [404, 'NOT_FOUND'],
    [400, 'VALIDATION_FAILED'],
  ])('says it could not find the service on a %s', async (status, code) => {
    serve(() => errorBody(status, code));
    render();
    expect(await heading('We could not find this service')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All services' })).toBeInTheDocument();
  });

  it('shows another failure with its request id and tries again', async () => {
    let failing = true;
    serve(() =>
      failing ? errorBody(500, 'INTERNAL_ERROR') : HttpResponse.json({ data: service() }),
    );
    render();
    expect(await screen.findByText(/req-7/)).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await heading('Follow-up')).toBeInTheDocument();
  });

  it("never shows the first clinic's service after a clinic switch", async () => {
    found();
    render();
    await heading('Follow-up');
    serve(() => errorBody(404, 'NOT_FOUND'));
    act(() => {
      signIn('clinic-b');
    });
    expect(screen.queryByText('Follow-up')).not.toBeInTheDocument();
    expect(await heading('We could not find this service')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    found({ isActive: false });
    const { container } = render();
    await heading('Follow-up');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('editing a service on its page', () => {
  const manager = () => {
    signIn('clinic-a', ['services.manage']);
  };
  const errorFor = (status: number, code: string) => errorBody(status, code);

  /** Serves the service (as last saved) and answers a PATCH. */
  function setup(reply?: () => Response, over: Record<string, unknown> = {}) {
    manager();
    let current = service(over);
    let reads = 0;
    const sent: { body: unknown; tenant: string | null }[] = [];
    server.use(
      http.get(`${API}/services/:serviceId`, () => {
        reads += 1;
        return HttpResponse.json({ data: current });
      }),
      http.patch(`${API}/services/s1`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        sent.push({ body, tenant: request.headers.get('x-expected-tenant-id') });
        if (reply) return reply();
        current = { ...current, ...body };
        return HttpResponse.json({ data: current });
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    const view = renderWithProviders(<ServicePage serviceId="s1" />, { queryClient });
    return {
      sent,
      queryClient,
      reads: () => reads,
      change: (next: Record<string, unknown>) => {
        current = { ...current, ...next };
      },
      ...view,
    };
  }
  const edit = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByRole('button', { name: 'Save changes' });
  };
  const save = () => userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  const retype = async (label: string, text: string) => {
    await userEvent.clear(screen.getByLabelText(label));
    if (text) await userEvent.type(screen.getByLabelText(label), text);
  };

  it('offers a manager Edit and Deactivate', async () => {
    setup();
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
  });

  it('opens on a fresh read, filled', async () => {
    const view = setup();
    await heading('Follow-up');
    view.change({ name: 'Renamed elsewhere' });
    await edit();
    expect(view.reads()).toBe(2);
    expect(screen.getByRole('heading', { level: 1, name: 'Edit service' })).toBeInTheDocument();
    expect(screen.getByLabelText('Service name')).toHaveValue('Renamed elsewhere');
    expect(screen.getByLabelText('Usual length, in minutes')).toHaveValue('60');
    expect(screen.getByRole('radio', { name: 'Fixed price' })).toBeChecked();
    expect(screen.getByLabelText('Amount')).toHaveValue('300.00');
  });

  it('does not edit a stale copy when the fresh read fails', async () => {
    setup();
    await heading('Follow-up');
    serve(() => errorFor(500, 'INTERNAL_ERROR'));
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByText(/req-7/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('sends only what changed, then shows the saved service', async () => {
    const view = setup();
    await edit();
    await retype('Amount', '350');
    await save();
    await heading('Follow-up');
    await waitFor(() => {
      expect(detail('Price')).toHaveTextContent('₱350.00');
    });
    expect(view.sent).toEqual([{ body: { price: '350.00' }, tenant: 'clinic-a' }]);
  });

  it('sends null when a fixed price becomes no fixed price', async () => {
    const view = setup();
    await edit();
    await userEvent.click(screen.getByRole('radio', { name: 'No fixed price' }));
    await save();
    await waitFor(() => {
      expect(view.sent[0]?.body).toEqual({ price: null });
    });
  });

  it('sends nothing when nothing changed, and says so', async () => {
    const view = setup();
    await edit();
    await save();
    expect(await screen.findByText('Nothing to change.')).toBeInTheDocument();
    expect(view.sent).toEqual([]);
  });

  it('goes back without saving on Cancel', async () => {
    const view = setup();
    await edit();
    await retype('Service name', 'Not saved');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await heading('Follow-up')).toBeInTheDocument();
    expect(view.sent).toEqual([]);
  });

  it('puts a taken name under Name and keeps what was typed', async () => {
    setup(() => errorFor(409, 'CONFLICT_UNIQUE'));
    await edit();
    await retype('Service name', 'Vaccination');
    await save();
    expect(
      await screen.findAllByText('This clinic already has a service with this name.'),
    ).not.toHaveLength(0);
    expect(screen.getByLabelText('Service name')).toHaveValue('Vaccination');
  });

  it('says it could not find a service gone by the time of saving', async () => {
    setup(() => errorFor(404, 'NOT_FOUND'));
    await edit();
    await retype('Service name', 'Anything');
    await save();
    expect(await heading('We could not find this service')).toBeInTheDocument();
  });

  it('keeps the form and what was typed when the clinic is switched elsewhere', async () => {
    const view = setup(() => errorFor(409, 'TENANT_MISMATCH'));
    await edit();
    await retype('Service name', 'Typed here');
    serve(() => errorFor(404, 'NOT_FOUND'));
    act(() => {
      signIn('clinic-b', ['services.manage']);
      view.queryClient.clear();
    });
    await save();
    expect(
      await screen.findByText(
        'This page was opened for Sunrise Clinic. You are now working in Lakeside Clinic. Nothing was saved.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Service name')).toHaveValue('Typed here');
    expect(view.sent[0]?.tenant).toBe('clinic-a');
  });

  it('marks a deactivated service at once', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Deactivate' }),
    );
    expect(
      await screen.findByText('This service is inactive. It is not offered when booking.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  });

  it('says it could not find a service gone by the time of reactivating', async () => {
    setup(() => errorFor(404, 'NOT_FOUND'), { isActive: false });
    await heading('Follow-up');
    const button = screen.getByRole('button', { name: 'Reactivate' });
    serve(() => errorFor(404, 'NOT_FOUND'));
    await userEvent.click(button);
    expect(await heading('We could not find this service')).toBeInTheDocument();
  });

  it('has no accessibility violations on the form', async () => {
    const view = setup();
    await edit();
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
