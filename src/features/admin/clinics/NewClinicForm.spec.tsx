import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { NewClinicForm } from './NewClinicForm.tsx';

const API = 'http://localhost:3000/api/v1';
const errorBody = (status: number, code: string, details?: unknown[]) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-8', ...(details && { details }) } },
    { status },
  );

async function fill({
  name = 'Bayview Clinic',
  owner = 'Dr. Maria Santos',
  email = 'maria@bayview.example',
}: { name?: string; owner?: string; email?: string } = {}) {
  await userEvent.type(screen.getByLabelText('Clinic name'), name);
  await userEvent.type(screen.getByLabelText("Owner's full name"), owner);
  await userEvent.type(screen.getByLabelText("Owner's email"), email);
}
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Create clinic' }));

describe('NewClinicForm', () => {
  it('suggests the web address name from the clinic name while the admin has not edited it', async () => {
    renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    await userEvent.type(screen.getByLabelText('Clinic name'), 'Peña Family Clinic');
    expect(screen.getByLabelText('Web address name')).toHaveValue('pena-family-clinic');
  });

  it('stops following the clinic name once the admin edits the web address name', async () => {
    renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    await userEvent.type(screen.getByLabelText('Clinic name'), 'Bay');
    const slug = screen.getByLabelText('Web address name');
    await userEvent.clear(slug);
    await userEvent.type(slug, 'my-own');
    await userEvent.type(screen.getByLabelText('Clinic name'), 'view Clinic');
    expect(slug).toHaveValue('my-own');
  });

  it('defaults the time zone to Asia/Manila', () => {
    renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    expect(screen.getByRole('combobox', { name: 'Time zone' })).toHaveTextContent('Asia/Manila');
  });

  it('sends exactly the fields the API expects, then reports the new clinic', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/admin/tenants`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { id: 'new-1' } }, { status: 201 });
      }),
    );
    const onCreated = vi.fn();
    renderWithProviders(<NewClinicForm onCreated={onCreated} />);
    await fill();
    await submit();
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith({ id: 'new-1', ownerEmail: 'maria@bayview.example' });
    });
    expect(bodies).toEqual([
      {
        name: 'Bayview Clinic',
        slug: 'bayview-clinic',
        ownerEmail: 'maria@bayview.example',
        ownerFullName: 'Dr. Maria Santos',
        timezone: 'Asia/Manila',
      },
    ]);
  });

  it('sends the time zone the admin chose', async () => {
    const bodies: { timezone?: string }[] = [];
    server.use(
      http.post(`${API}/admin/tenants`, async ({ request }) => {
        bodies.push((await request.json()) as { timezone?: string });
        return HttpResponse.json({ data: { id: 'n' } }, { status: 201 });
      }),
    );
    renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    await fill();
    await userEvent.click(screen.getByRole('combobox', { name: 'Time zone' }));
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search' }), 'Tokyo');
    await userEvent.click(await screen.findByRole('option', { name: 'Asia/Tokyo' }));
    await submit();
    await waitFor(() => {
      expect(bodies[0]?.timezone).toBe('Asia/Tokyo');
    });
  });

  it('asks for every required field and sends nothing when they are empty', async () => {
    const send = vi.fn();
    server.use(
      http.post(`${API}/admin/tenants`, () => {
        send();
        return errorBody(400, 'VALIDATION_FAILED');
      }),
    );
    renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    await submit();
    const summary = screen.getByRole('alert');
    expect(summary).toHaveTextContent('4 things need fixing');
    expect(screen.getByLabelText('Clinic name')).toHaveAccessibleDescription(
      'Enter the clinic name.',
    );
    expect(screen.getByLabelText('Web address name')).toHaveAccessibleDescription(
      /Enter a web address name/,
    );
    expect(screen.getByLabelText("Owner's full name")).toHaveAccessibleDescription(
      "Enter the owner's full name.",
    );
    expect(screen.getByLabelText("Owner's email")).toHaveAccessibleDescription(
      /Enter the owner's email address\./,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ['Bad Slug', 'Use lower-case letters and numbers, with single hyphens between words.'],
    ['-bad', 'Use lower-case letters and numbers, with single hyphens between words.'],
    ['a'.repeat(61), 'Use at most 60 characters.'],
  ])('rejects the web address name %j before sending', async (slug, message) => {
    const send = vi.fn();
    server.use(
      http.post(`${API}/admin/tenants`, () => {
        send();
        return errorBody(400, 'VALIDATION_FAILED');
      }),
    );
    renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    await fill();
    const field = screen.getByLabelText('Web address name');
    await userEvent.clear(field);
    await userEvent.type(field, slug);
    await submit();
    expect(field).toHaveAccessibleDescription(
      new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects an email without an @ before sending', async () => {
    renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    await fill({ email: 'maria-at-example' });
    await submit();
    expect(screen.getByLabelText("Owner's email")).toHaveAccessibleDescription(
      /Enter a valid email address\./,
    );
  });

  it('puts a taken web address name on that field and keeps everything typed (409)', async () => {
    server.use(http.post(`${API}/admin/tenants`, () => errorBody(409, 'CONFLICT_UNIQUE')));
    renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    await fill();
    await submit();
    await waitFor(() => {
      expect(screen.getByLabelText('Web address name')).toHaveAccessibleDescription(
        /This web address name is already used\. Choose another\./,
      );
    });
    expect(screen.getByLabelText('Clinic name')).toHaveValue('Bayview Clinic');
    expect(screen.getByLabelText("Owner's email")).toHaveValue('maria@bayview.example');
  });

  it("puts the API's field errors on their fields (400)", async () => {
    server.use(
      http.post(`${API}/admin/tenants`, () =>
        errorBody(400, 'VALIDATION_FAILED', [
          { field: 'ownerEmail', code: 'INVALID_FORMAT', message: 'x' },
          { field: 'timezone', code: 'INVALID_FORMAT', message: 'x' },
        ]),
      ),
    );
    renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    await fill();
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('2 things need fixing');
    expect(screen.getByLabelText("Owner's email")).toHaveAccessibleDescription(
      /not in the expected format/,
    );
  });

  it('the summary’s "Time zone" link moves focus to the picker', async () => {
    server.use(
      http.post(`${API}/admin/tenants`, () =>
        errorBody(400, 'VALIDATION_FAILED', [
          { field: 'timezone', code: 'INVALID_VALUE', message: 'x' },
        ]),
      ),
    );
    renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    await fill();
    await submit();
    const summary = await screen.findByRole('alert');
    await userEvent.click(within(summary).getByRole('link', { name: 'Time zone' }));
    expect(screen.getByRole('combobox', { name: /Time zone/ })).toHaveFocus();
  });

  it('shows other failures on the page with the request id, keeping what was typed', async () => {
    server.use(http.post(`${API}/admin/tenants`, () => errorBody(503, 'SERVICE_UNAVAILABLE')));
    renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    await fill();
    await submit();
    expect(await screen.findByText(/req-8/)).toBeInTheDocument();
    expect(screen.getByLabelText('Clinic name')).toHaveValue('Bayview Clinic');
  });

  it('says how long to wait after too many tries', async () => {
    server.use(
      http.post(`${API}/admin/tenants`, () =>
        HttpResponse.json(
          { error: { status: 429, code: 'RATE_LIMITED', message: 'x', requestId: 'r' } },
          { status: 429, headers: { 'retry-after': '120' } },
        ),
      ),
    );
    renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    await fill();
    await submit();
    expect(
      await screen.findByText('Please wait 2 minutes before trying again.'),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations, empty and with errors', async () => {
    const { container } = renderWithProviders(<NewClinicForm onCreated={() => undefined} />);
    expect(await axe(container)).toHaveNoViolations();
    await submit();
    expect(await axe(container)).toHaveNoViolations();
    expect(within(container).getByRole('alert')).toBeInTheDocument();
  });
});
