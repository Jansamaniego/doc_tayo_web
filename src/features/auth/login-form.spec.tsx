import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { ApiError } from '@/api/errors.ts';
import { writePreference } from '@/lib/preferences.ts';
import { fakeController } from '@/test/fake-session.tsx';
import { renderWithProviders } from '@/test/render.tsx';

import { LoginForm } from './login-form.tsx';

const apiError = (
  code: ApiError['code'],
  status = 401,
  extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {},
) =>
  new ApiError({
    status,
    code,
    message: 'server text',
    details: [],
    requestId: 'req-77',
    ...extra,
  });

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

async function fill(email = 'owner@sunrise.test', password = 'dev-password-change-me-123') {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
}

describe('LoginForm', () => {
  it('has visible labels, the right autocomplete hints, a shared-computer choice and a way to reset the password', () => {
    renderWithProviders(<LoginForm onSignedIn={() => undefined} />, {
      controller: fakeController(),
    });
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('checkbox', { name: 'This is a shared computer' })).not.toBeChecked();
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('remembers on this device that it is a shared computer', () => {
    writePreference('sharedComputer', true);
    renderWithProviders(<LoginForm onSignedIn={() => undefined} />, {
      controller: fakeController(),
    });
    expect(screen.getByRole('checkbox', { name: 'This is a shared computer' })).toBeChecked();
  });

  it('signs in with what was typed and the shared-computer choice, then tells the page', async () => {
    const controller = fakeController();
    const onSignedIn = vi.fn();
    renderWithProviders(<LoginForm onSignedIn={onSignedIn} />, { controller });
    await fill();
    await userEvent.click(screen.getByRole('checkbox', { name: 'This is a shared computer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(controller.signIn).toHaveBeenCalledWith({
      email: 'owner@sunrise.test',
      password: 'dev-password-change-me-123',
      sharedComputer: true,
    });
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it('shows "Signing in…" and ignores a second press while waiting', async () => {
    let finish!: () => void;
    const controller = fakeController({
      signIn: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    renderWithProviders(<LoginForm onSignedIn={() => undefined} />, { controller });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    const busy = screen.getByRole('button', { name: 'Signing in…' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(busy);
    expect(controller.signIn).toHaveBeenCalledTimes(1);
    await act(() => {
      finish();
      return Promise.resolve();
    });
  });

  it('asks for what is missing in plain words, with a summary, and does not call the server', async () => {
    const controller = fakeController();
    renderWithProviders(<LoginForm onSignedIn={() => undefined} />, { controller });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('2 things need fixing')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email address.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.');
    expect(controller.signIn).not.toHaveBeenCalled();
  });

  describe('a wrong email or password', () => {
    it('says so in one plain sentence (never which one), keeps the email, clears and focuses the password', async () => {
      const controller = fakeController({
        signIn: vi.fn(() => Promise.reject(apiError('INVALID_CREDENTIALS'))),
      });
      const onSignedIn = vi.fn();
      renderWithProviders(<LoginForm onSignedIn={onSignedIn} />, { controller });
      await fill('owner@sunrise.test', 'wrong-password-1');
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The email or password is incorrect.',
      );
      expect(screen.getByLabelText('Email')).toHaveValue('owner@sunrise.test');
      expect(screen.getByLabelText('Password')).toHaveValue('');
      expect(screen.getByLabelText('Password')).toHaveFocus();
      expect(onSignedIn).not.toHaveBeenCalled();
    });
  });

  describe('too many attempts (429)', () => {
    it('says how long to wait, counts it down in words, and blocks the button with the reason beside it', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const controller = fakeController({
        signIn: vi.fn(() =>
          Promise.reject(apiError('RATE_LIMITED', 429, { retryAfterSeconds: 90 })),
        ),
      });
      renderWithProviders(<LoginForm onSignedIn={() => undefined} />, { controller });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.type(screen.getByLabelText('Email'), 'owner@sunrise.test');
      await user.type(screen.getByLabelText('Password'), 'password-123456');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(
        await screen.findByText('Please wait 2 minutes before trying again.'),
      ).toBeInTheDocument();
      const button = screen.getByRole('button', { name: 'Sign in' });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAccessibleDescription('Please wait 2 minutes before trying again.');
      await user.click(button);
      expect(controller.signIn).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000);
      });
      expect(screen.getByText('Please wait 59 seconds before trying again.')).toBeInTheDocument();
    });

    it('lets the person try again when the wait is over', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const signIn = vi
        .fn()
        .mockRejectedValueOnce(apiError('RATE_LIMITED', 429, { retryAfterSeconds: 3 }))
        .mockResolvedValueOnce(undefined);
      const onSignedIn = vi.fn();
      renderWithProviders(<LoginForm onSignedIn={onSignedIn} />, {
        controller: fakeController({ signIn }),
      });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.type(screen.getByLabelText('Email'), 'owner@sunrise.test');
      await user.type(screen.getByLabelText('Password'), 'password-123456');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));
      await screen.findByText(/Please wait 3 seconds/);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
      expect(screen.getByRole('button', { name: 'Sign in' })).not.toHaveAttribute('aria-disabled');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(onSignedIn).toHaveBeenCalled();
    });
  });

  it('shows a server or network problem in plain words, with the request id for support, and keeps what was typed', async () => {
    const controller = fakeController({
      signIn: vi.fn(() => Promise.reject(apiError('SERVICE_UNAVAILABLE', 503))),
    });
    renderWithProviders(<LoginForm onSignedIn={() => undefined} />, { controller });
    await fill('owner@sunrise.test', 'password-123456');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('The service is not available right now. Please try again shortly.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/req-77/)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('password-123456');
  });

  it('says it could not connect when the network fails', async () => {
    const controller = fakeController({
      signIn: vi.fn(() => Promise.reject(apiError('NETWORK_ERROR', 0))),
    });
    renderWithProviders(<LoginForm onSignedIn={() => undefined} />, { controller });
    await fill();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/We could not connect/)).toBeInTheDocument();
  });

  describe('why the person is here', () => {
    it.each([
      ['inactive', 'You were signed out because the computer was not used for 10 minutes.'],
      ['expired', 'Your session ended. Please sign in again.'],
      ['signed-out-elsewhere', 'You signed out in another window.'],
      [
        'password-changed',
        'Your password was changed. For your safety, every device was signed out.',
      ],
    ] as const)('says so for "%s"', (notice, text) => {
      renderWithProviders(<LoginForm notice={notice} onSignedIn={() => undefined} />, {
        controller: fakeController(),
      });
      expect(screen.getByRole('status')).toHaveTextContent(text);
    });
  });

  it('has no accessibility violations (empty, with a notice, with errors)', async () => {
    const { container } = renderWithProviders(
      <LoginForm notice="inactive" onSignedIn={() => undefined} />,
      { controller: fakeController() },
    );
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
