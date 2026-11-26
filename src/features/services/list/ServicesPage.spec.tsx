import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';
import { mockWideScreen } from '@/test/wide-screen.ts';

import { ServicesPage, type ServicesSearch } from './ServicesPage.tsx';

const API = 'http://localhost:3000/api/v1';
const service = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  name: 'Follow-up',
  description: 'A second visit.',
  defaultDurationMinutes: 15,
  price: '1250.50',
  currency: 'PHP',
  isActive: true,
  createdAt: '2026-11-27T00:00:00.000Z',
  updatedAt: '2026-11-27T00:00:00.000Z',
  ...over,
});
const SERVICES = [
  service(),
  service({
    id: 's2',
    name: 'General consultation',
    description: null,
    defaultDurationMinutes: 90,
    price: null,
  }),
  service({ id: 's3', name: 'Blood pressure check', price: '0.00' }),
];
const page = (data: unknown[], over: Record<string, number> = {}) => ({
  data,
  meta: { page: 1, pageSize: 20, totalItems: data.length, totalPages: 1, ...over },
});
const errorBody = (status: number, code: string) =>
  HttpResponse.json({ error: { status, code, message: 'x', requestId: 'req-7' } }, { status });

const READER = ['tenant.read', 'services.read'];
const MANAGER = [...READER, 'services.manage'];

const signIn = (permissions: string[], activeTenantId = 'clinic-a'): void => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me Myself' },
    memberships: [],
    activeTenantId,
    permissions,
    platformRole: 'none',
    practitionerProfileId: null,
  });
};
mockWideScreen();
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

function serve(
  reply: (query: URLSearchParams) => Response = () => HttpResponse.json(page(SERVICES)),
) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/services`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      queries.push(query);
      return reply(query);
    }),
  );
  return queries;
}

function render(search: ServicesSearch = {}) {
  const onSearchChange = vi.fn();
  const onPageGone = vi.fn();
  const view = renderWithProviders(
    <ServicesPage search={search} onSearchChange={onSearchChange} onPageGone={onPageGone} />,
  );
  return { ...view, onSearchChange, onPageGone };
}

const rowOf = (name: string) => screen.getByRole('link', { name }).closest('tr') as HTMLElement;

describe('ServicesPage', () => {
  it('heads the page, says who is paid where, and marks the Services tab', async () => {
    signIn(READER);
    serve();
    render();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Services and prices' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Prices the front desk quotes. Patients pay at the desk.'),
    ).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Clinic sections' });
    expect(within(tabs).getByRole('link', { name: 'Services' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await screen.findByRole('table', { name: 'Services' })).toBeInTheDocument();
  });

  it('lists name, description, usual length in words and price, in the order sent', async () => {
    signIn(READER);
    serve();
    render();
    await screen.findByRole('table', { name: 'Services' });
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Service',
      'Usual length',
      'Price',
    ]);
    expect(
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getByRole('link').textContent),
    ).toEqual(['Follow-up', 'General consultation', 'Blood pressure check']);
    expect(screen.getByRole('link', { name: 'Follow-up' })).toHaveAttribute(
      'href',
      '/clinic/services/s1',
    );
    expect(within(rowOf('Follow-up')).getByText('A second visit.')).toBeInTheDocument();
    expect(within(rowOf('Follow-up')).getByText('15 minutes')).toBeInTheDocument();
    expect(
      within(rowOf('General consultation')).getByText('1 hour 30 minutes'),
    ).toBeInTheDocument();
  });

  it('shows a fixed price, Free and Price at the desk, and reads a price as words', async () => {
    signIn(READER);
    serve();
    render();
    await screen.findByRole('table', { name: 'Services' });
    const fixed = within(rowOf('Follow-up'));
    expect(fixed.getByText('₱1,250.50')).toHaveAttribute('aria-hidden', 'true');
    expect(fixed.getByText('1,250 pesos and 50 centavos')).toBeInTheDocument();
    expect(
      within(rowOf('General consultation')).getByText('Price at the desk'),
    ).toBeInTheDocument();
    expect(within(rowOf('Blood pressure check')).getByText('Free')).toBeInTheDocument();
  });

  it('never offers a payment or a total', async () => {
    signIn(MANAGER);
    serve();
    const { container } = render();
    await screen.findByRole('table', { name: 'Services' });
    expect(container).not.toHaveTextContent(/\b(Pay now|Charge|Total|Cart|Receipt)\b/i);
    expect(screen.queryByRole('button', { name: /pay/i })).not.toBeInTheDocument();
  });

  it('shows a reader no status and no inactive switch, and never asks for inactive services', async () => {
    signIn(READER);
    const queries = serve();
    render({ inactive: 1 });
    await screen.findByRole('table', { name: 'Services' });
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(queries[0]?.has('includeInactive')).toBe(false);
  });

  it('shows a manager the status of each service', async () => {
    signIn(MANAGER);
    serve(() =>
      HttpResponse.json(page([service(), service({ id: 's4', name: 'Old', isActive: false })])),
    );
    render({ inactive: 1 });
    await screen.findByRole('table', { name: 'Services' });
    expect(within(rowOf('Follow-up')).getByText('Active')).toBeInTheDocument();
    expect(within(rowOf('Old')).getByText('Inactive')).toBeInTheDocument();
  });

  it('asks for inactive services when the address says so, with the box ticked', async () => {
    signIn(MANAGER);
    const queries = serve(() =>
      HttpResponse.json(page(SERVICES, { totalItems: 120, totalPages: 3 })),
    );
    render({ inactive: 1, page: 2, pageSize: 50 });
    await screen.findByRole('table', { name: 'Services' });
    expect(screen.getByRole('checkbox', { name: 'Show inactive services' })).toBeChecked();
    expect(Object.fromEntries(queries[0] ?? [])).toEqual({
      page: '2',
      pageSize: '50',
      includeInactive: 'true',
    });
  });

  it('puts the box in the address and starts again at page 1', async () => {
    signIn(MANAGER);
    serve(() => HttpResponse.json(page(SERVICES, { totalItems: 120, totalPages: 3 })));
    const first = render({ page: 3, pageSize: 50 });
    await screen.findByRole('table', { name: 'Services' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show inactive services' }));
    expect(first.onSearchChange).toHaveBeenCalledWith({ pageSize: 50, inactive: 1 });
    first.unmount();
    const second = render({ inactive: 1 });
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show inactive services' }));
    expect(second.onSearchChange).toHaveBeenCalledWith({});
  });

  it('moves between pages and page sizes through the address', async () => {
    signIn(MANAGER);
    serve(() => HttpResponse.json(page(SERVICES, { totalItems: 45, totalPages: 3 })));
    const { onSearchChange } = render({ inactive: 1 });
    await screen.findByRole('table', { name: 'Services' });
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(onSearchChange).toHaveBeenLastCalledWith({ inactive: 1, page: 2 });
    await userEvent.selectOptions(screen.getByLabelText('Per page'), '50');
    expect(onSearchChange).toHaveBeenLastCalledWith({ inactive: 1, pageSize: 50 });
  });

  it('asks to go to the last page when the address is past the end', async () => {
    signIn(READER);
    serve(() => HttpResponse.json(page([], { page: 9, totalItems: 45, totalPages: 3 })));
    const { onPageGone } = render({ page: 9 });
    await waitFor(() => {
      expect(onPageGone).toHaveBeenCalledWith(3);
    });
    expect(screen.queryByText('No services yet')).not.toBeInTheDocument();
  });

  it('offers Add a service to a manager only, also when there are no services', async () => {
    signIn(MANAGER);
    serve(() => HttpResponse.json(page([], { totalPages: 0 })));
    const first = render();
    await screen.findByText('No services yet');
    const links = screen.getAllByRole('link', { name: 'Add a service' });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/clinic/services/new');
    first.unmount();
    signIn(READER);
    render();
    await screen.findByText('No services yet');
    expect(screen.queryByRole('link', { name: 'Add a service' })).not.toBeInTheDocument();
  });

  it('shows loading, then says when there are no services', async () => {
    signIn(MANAGER);
    serve(() => HttpResponse.json(page([], { totalPages: 0 })));
    const { onPageGone } = render();
    expect(screen.getByText('Loading services…')).toBeInTheDocument();
    expect(await screen.findByText('No services yet')).toBeInTheDocument();
    expect(onPageGone).not.toHaveBeenCalled();
  });

  it('shows the error with its request id and tries again', async () => {
    signIn(READER);
    let failing = true;
    serve(() => (failing ? errorBody(500, 'INTERNAL_ERROR') : HttpResponse.json(page(SERVICES))));
    render();
    expect(await screen.findByText(/req-7/)).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Follow-up' })).toBeInTheDocument();
  });

  it("never shows the first clinic's services after a clinic switch", async () => {
    signIn(READER, 'clinic-a');
    const queries = serve(() =>
      HttpResponse.json(page([service({ name: `Service ${String(queries.length)}` })])),
    );
    render();
    expect(await screen.findByRole('link', { name: 'Service 1' })).toBeInTheDocument();
    act(() => {
      signIn(READER, 'clinic-b');
    });
    expect(screen.queryByRole('link', { name: 'Service 1' })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Service 2' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    signIn(MANAGER);
    serve();
    const { container } = render();
    await screen.findByRole('link', { name: 'Follow-up' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
