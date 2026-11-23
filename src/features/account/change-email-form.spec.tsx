import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { ChangeEmailForm } from './change-email-form.tsx';

const API = 'http://localhost:3000/api/v1';
const errorBody = (status: number, code: string, details: unknown[] = [], headers = {}) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-6', details } },
    { status, headers },
  );

function setup(reply?: (body: { newEmail: string }) => Response) {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${API}/me/email`, async ({ request }) => {
      const body = (await request.json()) as { newEmail: string; currentPassword: string };
      bodies.push(body);
      return reply ? reply(body) : HttpResponse.json({ data: { accepted: true } }, { status: 202 });
    }),
  );
  const view = renderWithProviders(<ChangeEmailForm currentEmail="ana@example.com" />);
  return { bodies, ...view };
}
const emailField = () => screen.getByLabelText('New email');
const passwordField = () => screen.getByLabelText('Your password');
const send = () => userEvent.click(screen.getByRole('button', { name: 'Send confirmation link' }));
const fill = async (email = 'new@example.com', password = 'correct-password-1') => {
  await userEvent.type(emailField(), email);
  await userEvent.type(passwordField(), password);
};

describe('ChangeEmailForm', () => {
  it('sends the trimmed new address and the current password, then says a link was sent without saying whether the address was free', async () => {
    const { bodies } = setup();
    await fill('  new@example.com ');
    await send();
    expect(
      await screen.findByText(
        'If new@example.com can be used, we sent a link to it. Open it within 30 minutes. Your email does not change until you do.',
      ),
    ).toBeInTheDocument();
    expect(bodies).toEqual([
      { newEmail: 'new@example.com', currentPassword: 'correct-password-1' },
    ]);
    // The form is gone: nothing else to press until "Use a different address".
    expect(screen.queryByLabelText('Your password')).not.toBeInTheDocument();
  });

  it('says exactly the same thing for a free and a taken address (the server answers 202 for both)', async () => {
    const texts: string[] = [];
    for (const address of ['free@example.com', 'taken@example.com']) {
      const { unmount } = setup();
      await fill(address);
      await send();
      const message = await screen.findByText(/we sent a link to it/);
      texts.push(message.textContent.replace(address, 'ADDRESS'));
      unmount();
    }
    expect(texts[0]).toBe(texts[1]);
  });

  it('"Use a different address" brings the empty form back', async () => {
    setup();
    await fill();
    await send();
    await userEvent.click(await screen.findByRole('button', { name: 'Use a different address' }));
    expect(emailField()).toHaveValue('');
    expect(passwordField()).toHaveValue('');
  });

  it('refuses an empty address, a wrong one, a missing password and the address the person already has, before sending', async () => {
    const { bodies } = setup();
    await send();
    expect(await screen.findAllByText('Enter the new email address.')).not.toHaveLength(0);
    expect(screen.getAllByText('Enter your password.')).not.toHaveLength(0);

    await userEvent.type(emailField(), 'not-an-email');
    await send();
    expect(await screen.findAllByText('Enter a valid email address.')).not.toHaveLength(0);

    await userEvent.clear(emailField());
    await userEvent.type(emailField(), 'ANA@example.com');
    await userEvent.type(passwordField(), 'whatever-123');
    await send();
    expect(await screen.findAllByText('That is already your email address.')).not.toHaveLength(0);
    expect(bodies).toEqual([]);
  });

  it('puts a wrong password under the password field, clears it, and keeps the address', async () => {
    setup(() =>
      errorBody(400, 'VALIDATION_FAILED', [
        { field: 'currentPassword', code: 'PASSWORD_INCORRECT', message: 'no' },
      ]),
    );
    await fill('new@example.com', 'wrong-password');
    await send();
    expect(await screen.findAllByText('The password is incorrect.')).not.toHaveLength(0);
    expect(emailField()).toHaveValue('new@example.com');
    expect(passwordField()).toHaveValue('');
  });

  it('lets the person fix the password and send again', async () => {
    let calls = 0;
    const { bodies } = setup(() => {
      calls += 1;
      return calls === 1
        ? errorBody(400, 'VALIDATION_FAILED', [
            { field: 'currentPassword', code: 'PASSWORD_INCORRECT', message: 'no' },
          ])
        : HttpResponse.json({ data: { accepted: true } }, { status: 202 });
    });
    await fill('new@example.com', 'wrong-password');
    await send();
    await screen.findAllByText('The password is incorrect.');
    await userEvent.type(passwordField(), 'right-password-1');
    await send();
    await waitFor(() => {
      expect(bodies).toHaveLength(2);
    });
    expect(await screen.findByText(/we sent a link to it/)).toBeInTheDocument();
  });

  it('tells the person to wait after too many tries (429), and keeps what was typed', async () => {
    setup(() => errorBody(429, 'RATE_LIMITED', [], { 'Retry-After': '120' }));
    await fill();
    await send();
    expect(
      await screen.findByText(/Please wait 2 minutes before trying again/),
    ).toBeInTheDocument();
    expect(emailField()).toHaveValue('new@example.com');
  });

  it('shows any other failure with its request id', async () => {
    setup(() => errorBody(500, 'INTERNAL'));
    await fill();
    await send();
    expect(await screen.findByText(/req-6/)).toBeInTheDocument();
  });

  it('has no accessibility violations: empty, with errors, and after sending', async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
    await send();
    await screen.findAllByText('Enter the new email address.');
    expect(await axe(container)).toHaveNoViolations();
    await fill();
    await send();
    await screen.findByText(/we sent a link to it/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
