import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { sessionStore, type Membership } from '@/api/session/session-store.ts';
import { fakeController } from '@/test/fake-session.tsx';
import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { ScheduleEditorPage } from './ScheduleEditorPage.tsx';

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
    permissions: ['tenant.read', 'branches.read', 'directory.read', 'practitioners.manage'],
    platformRole: 'none',
    practitionerProfileId: null,
  });
}
const branch = (id: string, name: string, over: object = {}) => ({
  id,
  name,
  addressLine: null,
  city: null,
  province: null,
  timezone: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});
const MAIN = branch('main', 'Main');
const ANNEX = branch('annex', 'Annex', { timezone: 'Asia/Tokyo' });
const CLOSED = branch('closed', 'Old Site', { isActive: false });
interface Block {
  branchId: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
}
const on = (weekday: number, startsAt: string, endsAt: string, branchId = 'main'): Block => ({
  branchId,
  weekday,
  startsAt,
  endsAt,
});
const profile = (schedule: Block[]) => ({
  id: 'pr1',
  membershipId: 'm1',
  displayName: 'Dr. Ana Cruz, MD',
  specialization: null,
  prcLicenseNumber: null,
  ptrNumber: null,
  isActive: true,
  schedule,
});
const errorBody = (status: number, code: string, details: unknown[] = []) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: 'req-sc', details } },
    { status },
  );
const SAVED = [on(1, '09:00', '12:00'), on(1, '13:00', '17:00', 'annex'), on(2, '08:00', '10:00')];

function setup({
  schedule = SAVED,
  branches = [MAIN, ANNEX],
  reply,
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
}: {
  schedule?: Block[];
  branches?: ReturnType<typeof branch>[];
  reply?: () => Response;
  queryClient?: QueryClient;
} = {}) {
  const sent: { blocks: Block[]; tenant: string | null }[] = [];
  const reads = { profile: 0, branches: 0 };
  const state = { profileGone: false };
  server.use(
    http.get(`${API}/practitioners/pr1`, () => {
      reads.profile += 1;
      return state.profileGone
        ? errorBody(404, 'NOT_FOUND')
        : HttpResponse.json({ data: profile(schedule) });
    }),
    http.get(`${API}/branches`, () => {
      reads.branches += 1;
      return HttpResponse.json({
        data: branches,
        meta: { page: 1, pageSize: 100, totalItems: branches.length, totalPages: 1 },
      });
    }),
    http.get(`${API}/tenant`, () => HttpResponse.json({ data: { timezone: 'Asia/Manila' } })),
    http.put(`${API}/practitioners/pr1/schedule`, async ({ request }) => {
      const body = (await request.json()) as { blocks: Block[] };
      sent.push({ blocks: body.blocks, tenant: request.headers.get('x-expected-tenant-id') });
      return reply ? reply() : HttpResponse.json({ data: profile(body.blocks) });
    }),
  );
  const onSaved = vi.fn();
  const view = renderWithProviders(<ScheduleEditorPage profileId="pr1" onSaved={onSaved} />, {
    queryClient,
    controller: fakeController(),
  });
  return { sent, reads, state, onSaved, queryClient, ...view };
}

const ready = () => screen.findByRole('button', { name: 'Save schedule' });
const dayRegion = (name: string) => screen.getByRole('region', { name });
const hours = (name: string) => screen.queryByRole('group', { name });
const part = (group: string, label: string) =>
  within(screen.getByRole('group', { name: group })).getByLabelText(label);
async function pickTime(group: string, hour: string, minute: string, period: 'AM' | 'PM') {
  await userEvent.selectOptions(part(group, 'Hour'), hour);
  await userEvent.selectOptions(part(group, 'Minute'), minute);
  await userEvent.selectOptions(part(group, 'AM or PM'), period);
}
const timeShown = (group: string) =>
  ['Hour', 'Minute', 'AM or PM']
    .map((label) => (part(group, label) as HTMLSelectElement).value)
    .join(' ');
const branchSelect = (name: string) => screen.getByLabelText(`${name}: branch`);
const midnight = (name: string) =>
  screen.getByRole('checkbox', { name: `${name}: until midnight` });
const add = (day: string) =>
  userEvent.click(screen.getByRole('button', { name: `Add hours on ${day}` }));
const remove = (name: string) =>
  userEvent.click(screen.getByRole('button', { name: `Remove ${name}` }));
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
const copyFrom = (day: string) =>
  screen.getByRole('button', { name: `Copy ${day}'s hours to other days` });
async function copy(from: string, to: string[]) {
  await userEvent.click(copyFrom(from));
  const dialog = await screen.findByRole('dialog');
  for (const day of to) {
    await userEvent.click(within(dialog).getByRole('checkbox', { name: new RegExp(`^${day}`) }));
  }
  await userEvent.click(within(dialog).getByRole('button', { name: 'Copy hours' }));
}
const shows = async (text: string) => {
  expect(await screen.findAllByText(text)).not.toHaveLength(0);
};
const saved = async (onSaved: () => void) => {
  await waitFor(() => {
    expect(onSaved).toHaveBeenCalled();
  });
};

beforeEach(() => {
  signIn();
});
afterEach(() => {
  sessionStore.set({ status: 'signed-out' });
});

describe('ScheduleEditorPage', () => {
  it('opens on the saved week, seven days from Monday', async () => {
    setup();
    await ready();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Edit weekly schedule' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Edit weekly schedule');
    expect(screen.getByText('Dr. Ana Cruz, MD')).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(timeShown('Monday, hours 1: start')).toBe('9 00 AM');
    expect(timeShown('Monday, hours 2: end')).toBe('5 00 PM');
    expect(branchSelect('Monday, hours 2')).toHaveValue('annex');
    expect(
      within(branchSelect('Monday, hours 2')).getByRole('option', { name: 'Annex (Asia/Tokyo)' }),
    ).toBeInTheDocument();
    expect(within(dayRegion('Wednesday')).getByText('No hours')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/practitioners/pr1',
    );
  });

  it('reads the week afresh, not from what is already cached', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    queryClient.setQueryData(
      ['clinic-a', 'practitioners', 'detail', 'pr1'],
      profile([on(5, '01:00', '02:00')]),
    );
    const { reads } = setup({ queryClient });
    await ready();
    expect(reads.profile).toBe(1);
    expect(hours('Monday, hours 1: start')).toBeInTheDocument();
    expect(hours('Friday, hours 1: start')).not.toBeInTheDocument();
  });

  it('adds and removes hours, and sends the whole week in the opened clinic', async () => {
    const { sent, onSaved } = setup();
    await ready();
    await remove('Monday, hours 1');
    // The hours that were second are now first, with their own values.
    expect(timeShown('Monday, hours 1: start')).toBe('1 00 PM');
    await add('Sunday');
    expect(branchSelect('Sunday, hours 1')).toHaveValue('');
    await userEvent.selectOptions(branchSelect('Sunday, hours 1'), 'main');
    await pickTime('Sunday, hours 1: start', '9', '30', 'AM');
    await pickTime('Sunday, hours 1: end', '12', '00', 'PM');
    await save();
    await saved(onSaved);
    expect(sent).toEqual([
      {
        blocks: [
          on(1, '13:00', '17:00', 'annex'),
          on(2, '08:00', '10:00'),
          on(7, '09:30', '12:00'),
        ],
        tenant: 'clinic-a',
      },
    ]);
  });

  it('"Until midnight" replaces the end and sends 24:00', async () => {
    const { sent, onSaved } = setup({ schedule: [on(1, '18:00', '20:00')] });
    await ready();
    await userEvent.click(midnight('Monday, hours 1'));
    expect(hours('Monday, hours 1: end')).not.toBeInTheDocument();
    await userEvent.click(midnight('Monday, hours 1'));
    expect(timeShown('Monday, hours 1: end')).toBe('8 00 PM');
    await userEvent.click(midnight('Monday, hours 1'));
    await save();
    await saved(onSaved);
    expect(sent[0]?.blocks).toEqual([on(1, '18:00', '24:00')]);
  });

  it('shows a saved 24:00 as "Until midnight"', async () => {
    setup({ schedule: [on(1, '18:00', '24:00')] });
    await ready();
    expect(midnight('Monday, hours 1')).toBeChecked();
  });

  it('chooses the branch already when the clinic has only one active branch', async () => {
    setup({ schedule: [], branches: [MAIN, CLOSED] });
    await ready();
    await add('Monday');
    expect(branchSelect('Monday, hours 1')).toHaveValue('main');
    expect(
      within(branchSelect('Monday, hours 1')).queryByRole('option', { name: /Old Site/ }),
    ).not.toBeInTheDocument();
  });

  it('says so when there is no active branch to add hours at', async () => {
    setup({ schedule: [], branches: [CLOSED] });
    await ready();
    expect(screen.getByText('Add an active branch before adding hours.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add hours/ })).not.toBeInTheDocument();
  });

  it('refuses a missing part before sending, and links the summary to it', async () => {
    const { sent } = setup();
    await ready();
    await add('Wednesday');
    await save();
    await shows('Choose the branch.');
    await shows('Choose the start time.');
    await shows('Choose the end time.');
    const summary = screen.getByRole('alert');
    expect(summary).toHaveFocus();
    await userEvent.click(within(summary).getByRole('link', { name: 'Wednesday, hours 1: start' }));
    expect(part('Wednesday, hours 1: start', 'Hour')).toHaveFocus();
    await userEvent.click(
      within(summary).getByRole('link', { name: 'Wednesday, hours 1: branch' }),
    );
    expect(branchSelect('Wednesday, hours 1')).toHaveFocus();
    expect(sent).toEqual([]);
  });

  it('refuses an end that is not after the start, then sends the corrected week', async () => {
    const { sent, onSaved } = setup();
    await ready();
    await pickTime('Monday, hours 1: end', '8', '00', 'AM');
    await save();
    await shows('The end must be after the start.');
    expect(sent).toEqual([]);
    await pickTime('Monday, hours 1: end', '11', '00', 'AM');
    await save();
    await saved(onSaved);
    expect(sent).toHaveLength(1);
  });

  it('refuses hours that overlap on one day, even at different branches', async () => {
    const { sent } = setup();
    await ready();
    await pickTime('Monday, hours 2: start', '11', '00', 'AM');
    await save();
    await shows('These hours overlap other hours on this day.');
    expect(sent).toEqual([]);
  });

  it('refuses saved hours at a branch that is no longer active', async () => {
    const { sent } = setup({
      schedule: [on(1, '09:00', '12:00', 'closed')],
      branches: [MAIN, CLOSED],
    });
    await ready();
    expect(branchSelect('Monday, hours 1')).toHaveValue('closed');
    expect(
      within(branchSelect('Monday, hours 1')).getByRole('option', {
        name: 'Old Site (no longer active)',
      }),
    ).toBeInTheDocument();
    await pickTime('Monday, hours 1: end', '1', '00', 'PM');
    await save();
    await shows('This branch is no longer active.');
    expect(sent).toEqual([]);
  });

  it('refuses more than 50 blocks', async () => {
    const week = Array.from({ length: 50 }, (_, index) => {
      const hour = String(Math.floor(index / 7)).padStart(2, '0');
      return on((index % 7) + 1, `${hour}:00`, `${hour}:30`);
    });
    const { sent } = setup({ schedule: week });
    await ready();
    await add('Sunday');
    await userEvent.selectOptions(branchSelect('Sunday, hours 8'), 'main');
    await pickTime('Sunday, hours 8: start', '10', '00', 'PM');
    await pickTime('Sunday, hours 8: end', '11', '00', 'PM');
    await save();
    await shows('A week can have at most 50 blocks of hours. This one has 51.');
    expect(sent).toEqual([]);
  });

  it('sends nothing when nothing changed', async () => {
    const { sent } = setup();
    await ready();
    await save();
    expect(await screen.findByText('Nothing to change.')).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it('asks before saving an empty week, then sends []', async () => {
    const { sent, onSaved } = setup({ schedule: [on(1, '09:00', '12:00')] });
    await ready();
    await remove('Monday, hours 1');
    await save();
    let dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Dr. Ana Cruz, MD will have no working hours.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(sent).toEqual([]);
    await save();
    dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save empty week' }));
    await saved(onSaved);
    expect(sent[0]?.blocks).toEqual([]);
  });

  it('keeps the saved week for the practitioner page, even when reading it again fails', async () => {
    const { onSaved, queryClient, state } = setup();
    await ready();
    await remove('Tuesday, hours 1');
    state.profileGone = true;
    await save();
    await saved(onSaved);
    expect(
      queryClient.getQueryData<{ schedule: Block[] }>([
        'clinic-a',
        'practitioners',
        'detail',
        'pr1',
      ])?.schedule,
    ).toEqual(SAVED.slice(0, 2));
  });

  it('puts the API’s row errors on the rows they were sent from', async () => {
    const { onSaved } = setup({
      schedule: [on(2, '08:00', '10:00')],
      reply: () =>
        errorBody(400, 'VALIDATION_FAILED', [
          { field: 'blocks[0].startsAt', code: 'INVALID_VALUE', message: 'x' },
          { field: 'blocks[1].endsAt', code: 'INVALID_VALUE', message: 'x' },
        ]),
    });
    await ready();
    // Added after Tuesday, sent before it.
    await add('Monday');
    await userEvent.selectOptions(branchSelect('Monday, hours 1'), 'main');
    await pickTime('Monday, hours 1: start', '9', '00', 'AM');
    await pickTime('Monday, hours 1: end', '10', '00', 'AM');
    await save();
    const summary = await screen.findByRole('alert');
    expect(
      within(summary).getByRole('link', { name: 'Monday, hours 1: start' }),
    ).toBeInTheDocument();
    expect(
      within(summary).getByRole('link', { name: 'Tuesday, hours 1: end' }),
    ).toBeInTheDocument();
    expect(timeShown('Monday, hours 1: start')).toBe('9 00 AM');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('names an inactive branch the API reports, and reads the branches again', async () => {
    const { reads } = setup({
      reply: () =>
        errorBody(400, 'VALIDATION_FAILED', [
          { field: 'blocks[1].branchId', code: 'INVALID_VALUE', message: 'x' },
        ]),
    });
    await ready();
    await remove('Tuesday, hours 1');
    await save();
    await shows('This branch is no longer active.');
    await waitFor(() => {
      expect(reads.branches).toBe(2);
    });
  });

  it('shows a field error that names no row', async () => {
    setup({
      reply: () =>
        errorBody(400, 'VALIDATION_FAILED', [
          { field: 'blocks', code: 'OUT_OF_RANGE', message: 'x' },
        ]),
    });
    await ready();
    await remove('Tuesday, hours 1');
    await save();
    await shows('This is outside the allowed range.');
  });

  it('an unknown branch: says so and reads the branches again, keeping the week', async () => {
    const { reads } = setup({ reply: () => errorBody(404, 'NOT_FOUND') });
    await ready();
    await remove('Tuesday, hours 1');
    await save();
    await shows('A branch in this schedule no longer exists. Check the branches and save again.');
    await waitFor(() => {
      expect(reads.branches).toBe(2);
    });
    expect(hours('Monday, hours 1: start')).toBeInTheDocument();
  });

  it('an unknown profile on saving: could not find the practitioner', async () => {
    const { state } = setup({ reply: () => errorBody(404, 'NOT_FOUND') });
    await ready();
    state.profileGone = true;
    await remove('Tuesday, hours 1');
    await save();
    expect(
      await screen.findByRole('heading', { name: 'We could not find this practitioner' }),
    ).toBeInTheDocument();
  });

  it('after a 404, a failed second read is shown as itself, not as a missing branch', async () => {
    setup({ reply: () => errorBody(404, 'NOT_FOUND') });
    await ready();
    server.use(http.get(`${API}/practitioners/pr1`, () => errorBody(500, 'INTERNAL_ERROR')));
    await remove('Tuesday, hours 1');
    await save();
    expect(await screen.findByText(/req-sc/)).toBeInTheDocument();
    expect(screen.queryByText(/no longer exists/)).not.toBeInTheDocument();
  });

  it('an unknown profile on opening', async () => {
    server.use(http.get(`${API}/practitioners/pr1`, () => errorBody(404, 'NOT_FOUND')));
    server.use(
      http.get(`${API}/branches`, () => errorBody(500, 'INTERNAL_ERROR')),
      http.get(`${API}/tenant`, () => HttpResponse.json({ data: { timezone: 'Asia/Manila' } })),
    );
    renderWithProviders(<ScheduleEditorPage profileId="pr1" onSaved={vi.fn()} />);
    expect(
      await screen.findByRole('heading', { name: 'We could not find this practitioner' }),
    ).toBeInTheDocument();
  });

  it('shows a failed branches read with its request id', async () => {
    server.use(
      http.get(`${API}/practitioners/pr1`, () => HttpResponse.json({ data: profile([]) })),
      http.get(`${API}/branches`, () => errorBody(500, 'INTERNAL_ERROR')),
      http.get(`${API}/tenant`, () => HttpResponse.json({ data: { timezone: 'Asia/Manila' } })),
    );
    renderWithProviders(<ScheduleEditorPage profileId="pr1" onSaved={vi.fn()} />);
    expect(await screen.findByText(/req-sc/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('keeps the week after a failed save', async () => {
    setup({ reply: () => errorBody(500, 'INTERNAL_ERROR') });
    await ready();
    await remove('Tuesday, hours 1');
    await save();
    expect(await screen.findByText(/req-sc/)).toBeInTheDocument();
    expect(hours('Monday, hours 2: start')).toBeInTheDocument();
    expect(hours('Tuesday, hours 1: start')).not.toBeInTheDocument();
  });

  it('keeps the form when another tab switches clinic, and sends the opened clinic', async () => {
    const { sent, queryClient } = setup({ reply: () => errorBody(409, 'TENANT_MISMATCH') });
    await ready();
    await remove('Tuesday, hours 1');
    server.use(
      http.get(`${API}/practitioners/pr1`, () => errorBody(404, 'NOT_FOUND')),
      http.get(`${API}/branches`, () =>
        HttpResponse.json({
          data: [branch('lake', 'Lakeside Main')],
          meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
        }),
      ),
    );
    act(() => {
      queryClient.clear();
      signIn('clinic-b');
    });
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });
    expect(branchSelect('Monday, hours 1')).toHaveValue('main');
    expect(screen.queryByRole('option', { name: 'Lakeside Main' })).not.toBeInTheDocument();
    await save();
    await shows(
      'This page was opened for Sunrise Clinic. You are now working in Lakeside Clinic. Nothing was saved.',
    );
    expect(sent[0]?.tenant).toBe('clinic-a');
  });

  it('has no accessibility violations, plain and with errors', async () => {
    const { container } = setup();
    await ready();
    expect(await axe(container)).toHaveNoViolations();
    await add('Wednesday');
    await save();
    await screen.findByRole('alert');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ScheduleEditorPage: copy to other days (P7-13)', () => {
  it('replaces a day that has hours, after saying so, with exactly the source day’s blocks', async () => {
    const { sent, onSaved } = setup({
      schedule: [
        on(1, '09:00', '12:00'),
        on(1, '18:00', '24:00', 'annex'),
        on(2, '08:00', '10:00'),
        on(4, '14:00', '15:00'),
      ],
    });
    await ready();
    await userEvent.click(copyFrom('Monday'));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /^Tuesday/ }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /^Thursday/ }));
    expect(dialog).toHaveTextContent(
      'Tuesday and Thursday already have hours. They will be replaced.',
    );
    // Nothing is applied yet (the page behind the dialog is hidden from screen readers).
    const behind = screen.getByRole('group', { name: 'Tuesday, hours 1: start', hidden: true });
    expect(within(behind).getByLabelText('Hour')).toHaveValue('8');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copy hours' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    for (const day of ['Tuesday', 'Thursday']) {
      expect(timeShown(`${day}, hours 1: start`)).toBe('9 00 AM');
      expect(timeShown(`${day}, hours 1: end`)).toBe('12 00 PM');
      expect(branchSelect(`${day}, hours 1`)).toHaveValue('main');
      expect(timeShown(`${day}, hours 2: start`)).toBe('6 00 PM');
      expect(branchSelect(`${day}, hours 2`)).toHaveValue('annex');
      expect(midnight(`${day}, hours 2`)).toBeChecked();
      expect(hours(`${day}, hours 3: start`)).not.toBeInTheDocument();
    }
    // Copying only changes the form.
    expect(sent).toEqual([]);
    await save();
    await saved(onSaved);
    const monday = (weekday: number) => [
      on(weekday, '09:00', '12:00'),
      on(weekday, '18:00', '24:00', 'annex'),
    ];
    expect(sent.map((request) => request.blocks)).toEqual([
      [...monday(1), ...monday(2), ...monday(4)],
    ]);
  });

  it('leaves unticked days unchanged, the source day included', async () => {
    setup();
    await ready();
    await copy('Monday', ['Wednesday']);
    expect(timeShown('Monday, hours 1: start')).toBe('9 00 AM');
    expect(timeShown('Monday, hours 2: start')).toBe('1 00 PM');
    expect(timeShown('Tuesday, hours 1: start')).toBe('8 00 AM');
    expect(hours('Tuesday, hours 2: start')).not.toBeInTheDocument();
    expect(timeShown('Wednesday, hours 2: end')).toBe('5 00 PM');
    expect(within(dayRegion('Thursday')).getByText('No hours')).toBeInTheDocument();
  });

  it('makes independent copies: changing or removing one leaves the others', async () => {
    setup();
    await ready();
    await copy('Monday', ['Wednesday', 'Thursday']);
    await pickTime('Wednesday, hours 1: end', '11', '00', 'AM');
    await userEvent.click(midnight('Wednesday, hours 2'));
    await remove('Thursday, hours 1');
    for (const day of ['Monday', 'Wednesday']) {
      expect(branchSelect(`${day}, hours 2`)).toHaveValue('annex');
    }
    expect(timeShown('Monday, hours 1: end')).toBe('12 00 PM');
    expect(midnight('Monday, hours 2')).not.toBeChecked();
    expect(timeShown('Wednesday, hours 1: end')).toBe('11 00 AM');
    expect(timeShown('Thursday, hours 1: start')).toBe('1 00 PM');
    expect(midnight('Thursday, hours 1')).not.toBeChecked();
    expect(hours('Thursday, hours 2: start')).not.toBeInTheDocument();
  });

  it('works by keyboard alone, and focus returns to the button', async () => {
    setup();
    await ready();
    expect(
      screen.queryByRole('button', { name: "Copy Wednesday's hours to other days" }),
    ).not.toBeInTheDocument();
    const button = copyFrom('Monday');
    const tabTo = async (target: () => HTMLElement) => {
      for (let step = 0; step < 100 && document.activeElement !== target(); step += 1) {
        await userEvent.tab();
      }
      expect(target()).toHaveFocus();
    };
    await tabTo(() => button);
    // Escape cancels without changing anything.
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('dialog');
    await tabTo(() => screen.getByRole('checkbox', { name: /^Tuesday/ }));
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(timeShown('Tuesday, hours 1: start')).toBe('8 00 AM');
    // Space ticks, Enter on Copy hours applies.
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('dialog');
    await tabTo(() => screen.getByRole('checkbox', { name: /^Tuesday/ }));
    expect(screen.getByRole('checkbox', { name: /^Tuesday/ })).not.toBeChecked();
    await userEvent.keyboard(' ');
    await tabTo(() => screen.getByRole('button', { name: 'Copy hours' }));
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(timeShown('Tuesday, hours 1: start')).toBe('9 00 AM');
    expect(button).toHaveFocus();
  });

  it('refuses on Save a copy that pushes the week past 50 blocks', async () => {
    const monday = Array.from({ length: 11 }, (_, index) => {
      const hour = String(index + 1).padStart(2, '0');
      return on(1, `${hour}:00`, `${hour}:30`);
    });
    const { sent } = setup({ schedule: monday });
    await ready();
    await copy('Monday', ['Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    expect(sent).toEqual([]);
    await save();
    await shows('A week can have at most 50 blocks of hours. This one has 55.');
    expect(sent).toEqual([]);
  }, 30_000);
});
