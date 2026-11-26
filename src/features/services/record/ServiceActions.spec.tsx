import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import type { Service } from '../api/services.ts';
import { ServiceActions } from './ServiceActions.tsx';

const API = 'http://localhost:3000/api/v1';
const service = (isActive: boolean): Service => ({
  id: 's1',
  name: 'Follow-up',
  description: null,
  defaultDurationMinutes: 15,
  price: '300.00',
  currency: 'PHP',
  isActive,
  createdAt: '2026-11-27T00:00:00.000Z',
  updatedAt: '2026-11-27T00:00:00.000Z',
});

beforeEach(() => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'me@example.com', fullName: 'Me' },
    memberships: [],
    activeTenantId: 'clinic-a',
    permissions: ['services.read', 'services.manage'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

function setup({ isActive = true, fails = false } = {}) {
  const sent: { body: unknown; tenant: string | null }[] = [];
  server.use(
    http.patch(`${API}/services/s1`, async ({ request }) => {
      sent.push({
        body: await request.json(),
        tenant: request.headers.get('x-expected-tenant-id'),
      });
      return fails
        ? HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'x', requestId: 'req-sa' } },
            { status: 500 },
          )
        : HttpResponse.json({ data: service(!isActive) });
    }),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['clinic-a', 'services', 'list', {}], { data: [] });
  const onEdit = vi.fn();
  const view = renderWithProviders(<ServiceActions service={service(isActive)} onEdit={onEdit} />, {
    queryClient,
  });
  return { sent, onEdit, queryClient, ...view };
}
const button = (name: string) => screen.getByRole('button', { name });

describe('ServiceActions', () => {
  it('offers Edit as the main action and Deactivate for an active service', async () => {
    const { onEdit } = setup();
    expect(button('Edit')).toHaveAttribute('data-variant', 'primary');
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument();
    await userEvent.click(button('Edit'));
    expect(onEdit).toHaveBeenCalled();
  });

  it('asks before deactivating, with Cancel focused, then sends it and refreshes', async () => {
    const { sent, queryClient } = setup();
    await userEvent.click(button('Deactivate'));
    const dialog = screen.getByRole('alertdialog', { name: 'Deactivate Follow-up?' });
    expect(dialog).toHaveTextContent(
      'Follow-up will no longer be offered when booking. Nothing is deleted, and past records keep its name.',
    );
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(sent).toEqual([]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => {
      expect(sent).toEqual([{ body: { isActive: false }, tenant: 'clinic-a' }]);
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(['clinic-a', 'services', 'detail', 's1'])).toMatchObject({
        isActive: false,
      });
    });
    expect(queryClient.getQueryState(['clinic-a', 'services', 'list', {}])?.isInvalidated).toBe(
      true,
    );
  });

  it('sends nothing when the question is cancelled', async () => {
    const { sent } = setup();
    await userEvent.click(button('Deactivate'));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it('reactivates at once, as the main action of an inactive service', async () => {
    const { sent } = setup({ isActive: false });
    expect(button('Reactivate')).toHaveAttribute('data-variant', 'primary');
    expect(button('Edit')).toHaveAttribute('data-variant', 'secondary');
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    await userEvent.click(button('Reactivate'));
    await waitFor(() => {
      expect(sent).toEqual([{ body: { isActive: true }, tenant: 'clinic-a' }]);
    });
  });

  it('keeps a failure on the page', async () => {
    setup({ isActive: false, fails: true });
    await userEvent.click(button('Reactivate'));
    expect(await screen.findByText(/req-sa/)).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
  });
});
