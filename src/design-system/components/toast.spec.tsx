import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { notify, ToastRegion } from './toast.tsx';

afterEach(() => {
  vi.useRealTimers();
  act(() => {
    notify.clear();
  });
});

describe('Toast (confirmations only)', () => {
  it('shows a confirmation with an icon and words, in a polite live region', async () => {
    renderWithProviders(<ToastRegion />);
    act(() => {
      notify.success('Branch saved');
    });
    const toast = await screen.findByText('Branch saved');
    expect(toast.closest('li')).not.toBeNull();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(document.querySelector('[aria-live="polite"], [role="status"]')).not.toBeNull();
  });

  it('has an info kind too', async () => {
    renderWithProviders(<ToastRegion />);
    act(() => {
      notify.info('Invitation sent to ana@example.com. The link works for 7 days.');
    });
    expect(await screen.findByText(/Invitation sent/)).toBeInTheDocument();
    expect(screen.getByText('Information')).toBeInTheDocument();
  });

  it('has no error variant and no action: an error or an action belongs on the page', () => {
    // Compile-time checks only: never called.
    const typeChecks = (): void => {
      // @ts-expect-error there is no error toast
      notify.error('We could not save.'); // eslint-disable-line @typescript-eslint/no-unsafe-call
      // @ts-expect-error a toast takes only a message: no buttons, not even Undo
      notify.success('Saved', { action: { label: 'Undo' } });
    };
    expect(typeChecks).toBeTypeOf('function');
    expect(Object.keys(notify).sort()).toEqual(['clear', 'info', 'success']);
  });

  it('has a Close button with words', async () => {
    renderWithProviders(<ToastRegion />);
    act(() => {
      notify.success('Branch saved');
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Branch saved')).not.toBeInTheDocument();
  });

  it('stays at least 8 seconds, then goes by itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithProviders(<ToastRegion />);
    act(() => {
      notify.success('Branch saved');
    });
    expect(await screen.findByText('Branch saved')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7900);
    });
    expect(screen.getByText('Branch saved')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.queryByText('Branch saved')).not.toBeInTheDocument();
  });

  it('pauses while the keyboard focus is on it (plan §15a check)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithProviders(<ToastRegion />);
    act(() => {
      notify.success('Branch saved');
    });
    const close = await screen.findByRole('button', { name: 'Close' });
    act(() => {
      close.focus();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.getByText('Branch saved')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    renderWithProviders(<ToastRegion />);
    act(() => {
      notify.success('Branch saved');
    });
    await screen.findByText('Branch saved');
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});
