import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { tokenStore } from '@/api/session/token-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { ChangePasswordForm } from './change-password-form.tsx';

const API = 'http://localhost:3000/api/v1';
const errorBody = (status: number, code: string, details?: unknown[]) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-7', ...(details && { details }) } },
    { status },
  );

async function fill(current: string, next: string): Promise<void> {
  await userEvent.type(screen.getByLabelText('Current password'), current);
  await userEvent.type(screen.getByLabelText('New password'), next);
}

describe('ChangePasswordForm', () => {
  it('has the right autocomplete hints so a password manager can help', () => {
    renderWithProviders(<ChangePasswordForm email="ana@example.com" />);
    expect(screen.getByLabelText('Current password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(screen.getByLabelText('New password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('sends both passwords with the access token, says the other devices were signed out, and empties the form', async () => {
    tokenStore.set('access-1');
    const seen: { body: unknown; auth: string | null }[] = [];
    server.use(
      http.post(`${API}/me/password`, async ({ request }) => {
        seen.push({ body: await request.json(), auth: request.headers.get('authorization') });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<ChangePasswordForm email="ana@example.com" />);
    await fill('old-password-123', 'a-brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText(/Your password was changed/)).toBeInTheDocument();
    expect(screen.getByText(/Your other devices were signed out/)).toBeInTheDocument();
    expect(seen).toEqual([
      {
        body: { currentPassword: 'old-password-123', newPassword: 'a-brand-new-password' },
        auth: 'Bearer access-1',
      },
    ]);
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue('');
    tokenStore.clear();
  });

  it('asks for both passwords when they are empty and sends nothing', async () => {
    const send = vi.fn();
    server.use(
      http.post(`${API}/me/password`, () => {
        send();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<ChangePasswordForm email="ana@example.com" />);
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getByRole('alert')).toHaveTextContent('2 things need fixing');
    expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription(
      'Enter your current password.',
    );
    // The server-only hint stays in the description, followed by the error.
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
      /Enter a new password\./,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('shows live hints for the new password, including the email rule', () => {
    renderWithProviders(<ChangePasswordForm email="ana@example.com" />);
    expect(screen.getByText('10 to 128 characters')).toBeInTheDocument();
    expect(screen.getByText('Does not contain your email address')).toBeInTheDocument();
    expect(screen.getByText(/not a very common password/)).toBeInTheDocument();
  });

  it('puts a wrong current password on that field and keeps what was typed in the new one', async () => {
    server.use(
      http.post(`${API}/me/password`, () =>
        errorBody(400, 'VALIDATION_FAILED', [
          { field: 'currentPassword', code: 'PASSWORD_INCORRECT', message: 'x' },
        ]),
      ),
    );
    renderWithProviders(<ChangePasswordForm email="ana@example.com" />);
    await fill('wrong-password-1', 'a-brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription(
        'The password is incorrect.',
      );
    });
    expect(screen.getByLabelText('New password')).toHaveValue('a-brand-new-password');
    expect(screen.queryByText(/Your password was changed/)).not.toBeInTheDocument();
  });

  it('puts a too-common new password on the new-password field', async () => {
    server.use(
      http.post(`${API}/me/password`, () =>
        errorBody(400, 'VALIDATION_FAILED', [
          { field: 'newPassword', code: 'PASSWORD_TOO_COMMON', message: 'x' },
        ]),
      ),
    );
    renderWithProviders(<ChangePasswordForm email="ana@example.com" />);
    await fill('old-password-123', 'password1234');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
        /too easy to guess/,
      );
    });
  });

  it('says how long to wait after too many tries (5 per 15 minutes)', async () => {
    server.use(
      http.post(`${API}/me/password`, () =>
        HttpResponse.json(
          { error: { status: 429, code: 'RATE_LIMITED', message: 'x', requestId: 'r' } },
          { status: 429, headers: { 'retry-after': '600' } },
        ),
      ),
    );
    renderWithProviders(<ChangePasswordForm email="ana@example.com" />);
    await fill('old-password-123', 'a-brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(
      await screen.findByText('Please wait 10 minutes before trying again.'),
    ).toBeInTheDocument();
  });

  it('shows other failures on the page with the request id', async () => {
    server.use(http.post(`${API}/me/password`, () => errorBody(503, 'SERVICE_UNAVAILABLE')));
    renderWithProviders(<ChangePasswordForm email="ana@example.com" />);
    await fill('old-password-123', 'a-brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText(/req-7/)).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveValue('a-brand-new-password');
  });

  it('has no accessibility violations, empty, with errors, and after success', async () => {
    server.use(http.post(`${API}/me/password`, () => new HttpResponse(null, { status: 204 })));
    const { container } = renderWithProviders(<ChangePasswordForm email="ana@example.com" />);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await axe(container)).toHaveNoViolations();
    await fill('old-password-123', 'a-brand-new-password');
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await screen.findByText(/Your password was changed/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
