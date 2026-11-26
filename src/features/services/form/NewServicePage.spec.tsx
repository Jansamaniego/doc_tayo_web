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

import { NewServicePage } from './NewServicePage.tsx';

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
    permissions: ['services.read', 'services.manage'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
}
const created = {
  id: 's9',
  name: 'Dressing',
  description: null,
  defaultDurationMinutes: 30,
  price: null,
  currency: 'PHP',
  isActive: true,
  createdAt: '2026-11-27T00:00:00.000Z',
  updatedAt: '2026-11-27T00:00:00.000Z',
};
const errorBody = (status: number, code: string, details: unknown[] = []) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-ns', details } },
    { status },
  );

function setup(reply?: () => Response | Promise<Response>) {
  const sent: { body: unknown; tenant: string | null }[] = [];
  server.use(
    http.post(`${API}/services`, async ({ request }) => {
      sent.push({
        body: await request.json(),
        tenant: request.headers.get('x-expected-tenant-id'),
      });
      return reply ? reply() : HttpResponse.json({ data: created }, { status: 201 });
    }),
  );
  const onCreated = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['clinic-a', 'services', 'list', {}], { data: [] });
  const view = renderWithProviders(<NewServicePage onCreated={onCreated} />, {
    queryClient,
    controller: fakeController(),
  });
  return { sent, onCreated, queryClient, ...view };
}

const name = () => screen.getByLabelText('Service name');
const duration = () => screen.getByLabelText('Usual length, in minutes');
const amount = () => screen.getByLabelText('Amount');
const choose = (label: string) => userEvent.click(screen.getByRole('radio', { name: label }));
const add = () => userEvent.click(screen.getByRole('button', { name: 'Add service' }));
const retype = async (field: HTMLElement, text: string) => {
  await userEvent.clear(field);
  if (text) await userEvent.type(field, text);
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

describe('NewServicePage', () => {
  it('starts at 30 minutes with no fixed price, with a way back', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: 'Add a service' })).toBeInTheDocument();
    expect(document.title).toBe('Add a service');
    expect(name()).toHaveValue('');
    expect(duration()).toHaveValue('30');
    expect(duration()).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByRole('radiogroup', { name: 'Price' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'No fixed price' })).toBeChecked();
    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/clinic/services',
    );
  });

  it('asks for the amount only for a fixed price, and sends it as text without commas', async () => {
    const { sent, onCreated, queryClient } = setup();
    await userEvent.type(name(), ' Dressing ');
    await userEvent.type(screen.getByLabelText(/^Description/), 'Cleaning');
    await retype(duration(), '45');
    await choose('Fixed price');
    await userEvent.type(amount(), '1,250.5');
    await add();
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(created);
    });
    expect(sent).toEqual([
      {
        body: {
          name: 'Dressing',
          description: 'Cleaning',
          defaultDurationMinutes: 45,
          price: '1250.50',
        },
        tenant: 'clinic-a',
      },
    ]);
    // The list is read again when it is next shown.
    expect(queryClient.getQueryState(['clinic-a', 'services', 'list', {}])?.isInvalidated).toBe(
      true,
    );
  });

  it.each([
    ['Free', '0.00'],
    ['No fixed price', null],
  ])('sends "%s" as the price %s', async (label, price) => {
    const { sent } = setup();
    await userEvent.type(name(), 'Dressing');
    await choose(label);
    await add();
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.body).toMatchObject({ price, description: null });
  });

  it.each([
    ['', 'Enter an amount, for example 1,250.50.'],
    ['1.005', 'Enter an amount, for example 1,250.50.'],
    ['0', 'Choose Free for a service without charge.'],
    ['10000000000', 'Enter at most ₱9,999,999,999.99.'],
  ])('refuses the fixed price "%s"', async (typed, message) => {
    const { sent } = setup();
    await userEvent.type(name(), 'Dressing');
    await choose('Fixed price');
    if (typed) await userEvent.type(amount(), typed);
    await add();
    await shows(message);
    expect(sent).toEqual([]);
  });

  it('lists every problem, and a summary link focuses its field', async () => {
    const { sent } = setup();
    await retype(duration(), '4');
    await choose('Fixed price');
    await add();
    expect(await screen.findByText('3 things need fixing')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Amount' }));
    expect(amount()).toHaveFocus();
    await userEvent.click(screen.getByRole('link', { name: 'Usual length, in minutes' }));
    expect(duration()).toHaveFocus();
    expect(sent).toEqual([]);
  });

  it('puts a taken name under Name, keeps what was typed and reads the list again', async () => {
    const { onCreated, queryClient } = setup(() => errorBody(409, 'CONFLICT_UNIQUE'));
    await userEvent.type(name(), 'Follow-up');
    await add();
    await shows('This clinic already has a service with this name.');
    expect(name()).toHaveAttribute('aria-invalid', 'true');
    expect(name()).toHaveValue('Follow-up');
    expect(onCreated).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(['clinic-a', 'services', 'list', {}])?.isInvalidated).toBe(
      true,
    );
  });

  it('puts the API’s field problems on their fields', async () => {
    setup(() =>
      errorBody(400, 'VALIDATION_FAILED', [
        { field: 'price', code: 'INVALID_FORMAT', message: 'x' },
      ]),
    );
    await userEvent.type(name(), 'Dressing');
    await choose('Fixed price');
    await userEvent.type(amount(), '5');
    await add();
    await waitFor(() => {
      expect(amount()).toHaveAttribute('aria-invalid', 'true');
    });
    expect(screen.getByText('1 thing needs fixing')).toBeInTheDocument();
  });

  it('shows another failure with its request id', async () => {
    setup(() => errorBody(403, 'FORBIDDEN'));
    await userEvent.type(name(), 'Dressing');
    await add();
    expect(await screen.findByText(/req-ns/)).toBeInTheDocument();
    expect(name()).toHaveValue('Dressing');
  });

  it('sends once however often the button is pressed while saving', async () => {
    let answer: (response: Response) => void = () => undefined;
    const { sent, onCreated } = setup(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    await userEvent.type(name(), 'Dressing{Enter}');
    const button = await screen.findByRole('button', { name: 'Saving…' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    await userEvent.type(name(), '{Enter}');
    expect(sent).toHaveLength(1);
    act(() => {
      answer(HttpResponse.json({ data: created }, { status: 201 }));
    });
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps what was typed, and the clinic it was opened in, after a switch elsewhere', async () => {
    const { sent, queryClient } = setup(() => errorBody(409, 'TENANT_MISMATCH'));
    await userEvent.type(name(), 'Dressing');
    act(() => {
      signIn('clinic-b');
      queryClient.clear();
    });
    await add();
    await shows(
      'This page was opened for Sunrise Clinic. You are now working in Lakeside Clinic. Nothing was saved.',
    );
    expect(sent[0]?.tenant).toBe('clinic-a');
    expect(name()).toHaveValue('Dressing');
  });

  it('never offers a payment', () => {
    const { container } = setup();
    expect(container).not.toHaveTextContent(/\b(Pay now|Charge|Total|Cart|Receipt)\b/i);
  });

  it('has no accessibility violations, with the amount and with problems', async () => {
    const { container } = setup();
    await choose('Fixed price');
    await add();
    await screen.findByText(/need/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
