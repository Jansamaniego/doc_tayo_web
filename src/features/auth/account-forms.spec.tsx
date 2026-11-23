import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { AcceptInvitationForm } from './accept-invitation-form.tsx';
import { AccountSetupForm } from './account-setup-form.tsx';
import { ForgotPasswordForm } from './forgot-password-form.tsx';
import { ResetPasswordForm } from './reset-password-form.tsx';

const API = 'http://localhost:3000/api/v1';
const errorBody = (status: number, code: string, details?: unknown[]) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-9', ...(details && { details }) } },
    { status },
  );

describe('ForgotPasswordForm', () => {
  it('asks for the email only, and always gives the same answer (never says whether the account exists)', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/auth/password/forgot`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { accepted: true } }, { status: 202 });
      }),
    );
    renderWithProviders(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
    expect(
      await screen.findByText(/If there is an account for ana@example.com, we have sent a link/),
    ).toBeInTheDocument();
    expect(screen.getByText(/works for 30 minutes/)).toBeInTheDocument();
    expect(bodies).toEqual([{ email: 'ana@example.com' }]);
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
  });

  it('asks for the email when it is empty and sends nothing', async () => {
    const send = vi.fn();
    server.use(
      http.post(`${API}/auth/password/forgot`, () => {
        send();
        return new HttpResponse(null, { status: 202 });
      }),
    );
    renderWithProviders(<ForgotPasswordForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email address.');
    expect(send).not.toHaveBeenCalled();
  });

  it('says how long to wait when there were too many tries, and keeps the email', async () => {
    server.use(
      http.post(`${API}/auth/password/forgot`, () =>
        HttpResponse.json(
          { error: { status: 429, code: 'RATE_LIMITED', message: 'x', requestId: 'r' } },
          { status: 429, headers: { 'retry-after': '600' } },
        ),
      ),
    );
    renderWithProviders(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
    expect(
      await screen.findByText('Please wait 10 minutes before trying again.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com');
  });

  it('has no accessibility violations, before and after sending', async () => {
    server.use(
      http.post(`${API}/auth/password/forgot`, () => new HttpResponse(null, { status: 202 })),
    );
    const { container } = renderWithProviders(<ForgotPasswordForm />);
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send me a link' }));
    await screen.findByText(/we have sent a link/);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ResetPasswordForm', () => {
  it('sends the token and the new password, and nothing else, then says it worked', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/auth/password/reset`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onDone = vi.fn();
    renderWithProviders(<ResetPasswordForm token="tok-abc" onDone={onDone} />);
    await userEvent.type(screen.getByLabelText('New password'), 'a-long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    await vi.waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
    expect(bodies).toEqual([{ token: 'tok-abc', newPassword: 'a-long-enough-password' }]);
  });

  it('ticks the password hints as the person types', async () => {
    renderWithProviders(<ResetPasswordForm token="tok-abc" onDone={() => undefined} />);
    expect(screen.getByText('10 to 128 characters')).toBeInTheDocument();
    expect(screen.getByText('Not yet')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('New password'), '1234567890');
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(
      screen.getByText('We also check that it is not a very common password.'),
    ).toBeInTheDocument();
  });

  it('a link that is missing, used or expired says so and offers a new one', () => {
    renderWithProviders(<ResetPasswordForm token={null} onDone={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This link is not valid or has expired. Please ask for a new one.',
    );
    expect(screen.getByRole('link', { name: 'Send a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('TOKEN_INVALID from the server says the same and offers a new link, without erasing the password', async () => {
    server.use(http.post(`${API}/auth/password/reset`, () => errorBody(400, 'TOKEN_INVALID')));
    renderWithProviders(<ResetPasswordForm token="old" onDone={() => undefined} />);
    await userEvent.type(screen.getByLabelText('New password'), 'a-long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(
      await screen.findByText('This link is not valid or has expired. Please ask for a new one.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send a new link' })).toBeInTheDocument();
  });

  it('puts a server password problem under the field in plain words, and keeps the typed password', async () => {
    server.use(
      http.post(`${API}/auth/password/reset`, () =>
        errorBody(400, 'VALIDATION_FAILED', [
          { field: 'newPassword', code: 'PASSWORD_TOO_COMMON', message: 'x' },
        ]),
      ),
    );
    renderWithProviders(<ResetPasswordForm token="t" onDone={() => undefined} />);
    await userEvent.type(screen.getByLabelText('New password'), 'password1234567');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(
      await screen.findAllByText('This password is too easy to guess. Please choose another.'),
    ).not.toHaveLength(0);
    expect(screen.getByLabelText('New password')).toHaveValue('password1234567');
  });

  it('asks for a password when it is empty', async () => {
    renderWithProviders(<ResetPasswordForm token="t" onDone={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription(
      /Enter a new password\./,
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <ResetPasswordForm token="t" onDone={() => undefined} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('AccountSetupForm (a new clinic owner)', () => {
  it('sends the token and password, and the name only when one was typed', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/auth/account/setup`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onDone = vi.fn();
    renderWithProviders(<AccountSetupForm token="tok" onDone={onDone} />);
    await userEvent.type(screen.getByLabelText(/New password/), 'a-long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Set up my account' }));
    await vi.waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    await userEvent.type(screen.getByLabelText(/Your name/), 'Dr. Ana Cruz');
    await userEvent.click(screen.getByRole('button', { name: 'Set up my account' }));
    await vi.waitFor(() => {
      expect(bodies).toHaveLength(2);
    });
    expect(bodies[0]).toEqual({ token: 'tok', newPassword: 'a-long-enough-password' });
    expect(bodies[1]).toEqual({
      token: 'tok',
      newPassword: 'a-long-enough-password',
      fullName: 'Dr. Ana Cruz',
    });
  });

  it('marks the name as optional, and handles a used link', async () => {
    server.use(http.post(`${API}/auth/account/setup`, () => errorBody(400, 'TOKEN_INVALID')));
    renderWithProviders(<AccountSetupForm token="tok" onDone={() => undefined} />);
    expect(screen.getByText('Optional')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/New password/), 'a-long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Set up my account' }));
    expect(
      await screen.findByText('This link is not valid or has expired. Please ask for a new one.'),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <AccountSetupForm token="t" onDone={() => undefined} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('AcceptInvitationForm (the page cannot know whether the email already has an account)', () => {
  const requiredDetails = [
    { field: 'fullName', code: 'REQUIRED', message: 'x' },
    { field: 'newPassword', code: 'REQUIRED', message: 'x' },
  ];

  it('an existing person needs only the token', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/invitations/accept`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const onDone = vi.fn();
    renderWithProviders(<AcceptInvitationForm token="inv" onDone={onDone} />);
    expect(screen.queryByLabelText(/Your name/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
    await vi.waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    expect(bodies).toEqual([{ token: 'inv' }]);
  });

  it('a new person: the server asks for a name and password, so those two fields appear, and the next send includes them', async () => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(`${API}/invitations/accept`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return 'fullName' in body
          ? new HttpResponse(null, { status: 204 })
          : errorBody(400, 'VALIDATION_FAILED', requiredDetails);
      }),
    );
    const onDone = vi.fn();
    renderWithProviders(<AcceptInvitationForm token="inv" onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
    expect(
      await screen.findByText('Create your account to finish joining the clinic.'),
    ).toBeInTheDocument();
    // The first, empty try must not show "please fill in" errors: it was only a question.
    expect(screen.getByLabelText('Your name')).not.toHaveAttribute('aria-invalid');
    await userEvent.type(screen.getByLabelText('Your name'), 'Ben Lim');
    await userEvent.type(screen.getByLabelText('New password'), 'a-long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Create account and accept' }));
    await vi.waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
    expect(bodies[1]).toEqual({
      token: 'inv',
      fullName: 'Ben Lim',
      newPassword: 'a-long-enough-password',
    });
  });

  it('an invitation that is used or expired says so and what to do', async () => {
    server.use(http.post(`${API}/invitations/accept`, () => errorBody(400, 'TOKEN_INVALID')));
    renderWithProviders(<AcceptInvitationForm token="inv" onDone={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
    expect(
      await screen.findByText('This link is not valid or has expired. Please ask for a new one.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ask your clinic admin to send you a new invitation.'),
    ).toBeInTheDocument();
  });

  it('a missing link shows the same, without asking the server', () => {
    renderWithProviders(<AcceptInvitationForm token={null} onDone={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent('This link is not valid or has expired');
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
  });

  it('has no accessibility violations (first step and the create-account step)', async () => {
    server.use(
      http.post(`${API}/invitations/accept`, () =>
        errorBody(400, 'VALIDATION_FAILED', requiredDetails),
      ),
    );
    const { container } = renderWithProviders(
      <AcceptInvitationForm token="inv" onDone={() => undefined} />,
    );
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
    await screen.findByLabelText('Your name');
    expect(await axe(container)).toHaveNoViolations();
  });
});
