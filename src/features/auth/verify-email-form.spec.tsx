import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { VerifyEmailForm } from './verify-email-form.tsx';

const API = 'http://localhost:3000/api/v1';
const errorBody = (status: number, code: string, headers = {}) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-1', details: [] } },
    { status, headers },
  );

afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

function setup({
  token = 'tok-abc',
  reply,
}: { token?: string | null; reply?: () => Response } = {}) {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${API}/auth/email/verify`, async ({ request }) => {
      bodies.push(await request.json());
      return reply ? reply() : new HttpResponse(null, { status: 204 });
    }),
  );
  const onDone = vi.fn();
  const view = renderWithProviders(<VerifyEmailForm token={token} onDone={onDone} />);
  return { bodies, onDone, ...view };
}
const confirm = () =>
  userEvent.click(screen.getByRole('button', { name: 'Confirm new email address' }));

describe('VerifyEmailForm', () => {
  it('does nothing until the person presses the button (a link opened twice must not use the token up)', () => {
    const { bodies } = setup();
    expect(screen.getByText(/You will be signed out on every device/)).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('sends the token, and tells the page when the email was changed', async () => {
    const { bodies, onDone } = setup();
    await confirm();
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
    expect(bodies).toEqual([{ token: 'tok-abc' }]);
  });

  it('says the link is no good when there is no token in the address', () => {
    setup({ token: null });
    expect(
      screen.getByText('This link has expired, was already used, or a newer link was sent.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Confirm new email address' }),
    ).not.toBeInTheDocument();
  });

  it('TOKEN_INVALID says so, and offers My account to someone signed in', async () => {
    sessionStore.set({
      status: 'signed-in',
      user: { id: 'me', email: 'a@b.test', fullName: 'A' },
      memberships: [],
      activeTenantId: null,
      permissions: [],
      platformRole: 'none',
    });
    setup({ reply: () => errorBody(400, 'TOKEN_INVALID') });
    await confirm();
    expect(
      await screen.findByText('This link has expired, was already used, or a newer link was sent.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to My account' })).toHaveAttribute(
      'href',
      '/account',
    );
  });

  it('TOKEN_INVALID offers the sign-in page to someone who is signed out', async () => {
    setup({ reply: () => errorBody(400, 'TOKEN_INVALID') });
    await confirm();
    expect(await screen.findByRole('link', { name: 'Go to sign in' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('CONFLICT_UNIQUE says the address was taken meanwhile and nothing changed', async () => {
    const { onDone } = setup({ reply: () => errorBody(409, 'CONFLICT_UNIQUE') });
    await confirm();
    expect(
      await screen.findByText(
        'Someone else started using this address. Your email was not changed.',
      ),
    ).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('RATE_LIMITED asks the person to wait', async () => {
    setup({ reply: () => errorBody(429, 'RATE_LIMITED', { 'Retry-After': '60' }) });
    await confirm();
    expect(await screen.findByText(/Please wait 1 minute before trying again/)).toBeInTheDocument();
  });

  it('any other failure shows its words with the request id', async () => {
    setup({ reply: () => errorBody(500, 'INTERNAL') });
    await confirm();
    expect(await screen.findByText(/req-1/)).toBeInTheDocument();
  });

  it('has no accessibility violations, plain and after a failure', async () => {
    const { container } = setup({ reply: () => errorBody(400, 'TOKEN_INVALID') });
    expect(await axe(container)).toHaveNoViolations();
    await confirm();
    await screen.findByText('This link has expired, was already used, or a newer link was sent.');
    expect(await axe(container)).toHaveNoViolations();
  });
});
