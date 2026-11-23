import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore } from '@/api/session/session-store.ts';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { ProfileNameForm } from './profile-name-form.tsx';

const API = 'http://localhost:3000/api/v1';
const errorBody = (status: number, code: string, details: unknown[] = []) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-2', details } },
    { status },
  );

beforeEach(() => {
  sessionStore.set({
    status: 'signed-in',
    user: { id: 'me', email: 'ana@example.com', fullName: 'Ana Cruz' },
    memberships: [],
    activeTenantId: null,
    permissions: [],
    platformRole: 'none',
  });
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

function setup(reply?: () => Response) {
  const bodies: unknown[] = [];
  server.use(
    http.patch(`${API}/me`, async ({ request }) => {
      const body = (await request.json()) as { fullName: string };
      bodies.push(body);
      return reply
        ? reply()
        : HttpResponse.json({
            data: {
              id: 'me',
              email: 'ana@example.com',
              fullName: body.fullName,
              emailVerifiedAt: null,
              passwordChangedAt: null,
              platformRole: 'none',
              activeTenantId: null,
              permissions: [],
            },
          });
    }),
  );
  const view = renderWithProviders(<ProfileNameForm fullName="Ana Cruz" />);
  return { bodies, ...view };
}
const nameField = () => screen.getByLabelText('Name');
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save name' }));

describe('ProfileNameForm', () => {
  it('starts with the current name', () => {
    setup();
    expect(nameField()).toHaveValue('Ana Cruz');
  });

  it('sends the trimmed name and shows it at once in the session (the user menu reads it)', async () => {
    const { bodies } = setup();
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), '  Ana Maria Cruz ');
    await save();
    expect(await screen.findByText('Your name was saved.')).toBeInTheDocument();
    expect(bodies).toEqual([{ fullName: 'Ana Maria Cruz' }]);
    const state = sessionStore.get();
    expect(state.status === 'signed-in' && state.user.fullName).toBe('Ana Maria Cruz');
    // Nothing else of the session changed.
    expect(state.status === 'signed-in' && state.user.email).toBe('ana@example.com');
  });

  it('refuses a blank name and one over 120 characters, before sending', async () => {
    const { bodies } = setup();
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), '   ');
    await save();
    expect(await screen.findAllByText('Enter your name.')).not.toHaveLength(0);
    await userEvent.clear(nameField());
    await userEvent.click(nameField());
    await userEvent.paste('x'.repeat(121));
    await save();
    expect(await screen.findAllByText('A name can have at most 120 characters.')).not.toHaveLength(
      0,
    );
    expect(bodies).toEqual([]);
  });

  it('lets the person fix a refused name and save', async () => {
    const { bodies } = setup();
    await userEvent.clear(nameField());
    await save();
    await screen.findAllByText('Enter your name.');
    await userEvent.type(nameField(), 'Ana B');
    await save();
    await waitFor(() => {
      expect(bodies).toEqual([{ fullName: 'Ana B' }]);
    });
  });

  it('sends nothing when the name did not change, and says so', async () => {
    const { bodies } = setup();
    await save();
    expect(await screen.findByText('Nothing to change.')).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('puts the API’s field problem under the name and keeps what was typed', async () => {
    setup(() =>
      errorBody(400, 'VALIDATION_FAILED', [
        { field: 'fullName', code: 'TOO_LONG', message: 'too long' },
      ]),
    );
    await userEvent.type(nameField(), '!');
    await save();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(nameField()).toHaveValue('Ana Cruz!');
  });

  it('shows any other failure with its request id, and the session keeps the old name', async () => {
    setup(() => errorBody(500, 'INTERNAL'));
    await userEvent.type(nameField(), '!');
    await save();
    expect(await screen.findByText(/req-2/)).toBeInTheDocument();
    const state = sessionStore.get();
    expect(state.status === 'signed-in' && state.user.fullName).toBe('Ana Cruz');
  });

  it('has no accessibility violations, plain and with an error', async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.clear(nameField());
    await save();
    await screen.findAllByText('Enter your name.');
    expect(await axe(container)).toHaveNoViolations();
  });
});
