import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { EmptyState, ErrorState, LoadingState } from './state-views.tsx';

describe('EmptyState', () => {
  it('says plainly what is missing, with a decorative illustration', () => {
    const { container } = renderWithProviders(<EmptyState title="No branches yet" />);
    expect(screen.getByText('No branches yet')).toBeInTheDocument();
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows the action only when the person may act (permission-aware)', () => {
    const { rerender } = renderWithProviders(
      <EmptyState title="No branches yet" action={<button>Add branch</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Add branch' })).toBeInTheDocument();
    rerender(<EmptyState title="No branches yet" />);
    expect(screen.queryByRole('button', { name: 'Add branch' })).not.toBeInTheDocument();
  });

  it('can explain what to do next', () => {
    renderWithProviders(<EmptyState title="No patients found" description="Check the spelling." />);
    expect(screen.getByText('Check the spelling.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <EmptyState
        title="No branches yet"
        description="Add your first branch."
        action={<button>Add branch</button>}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('always tells screen readers what is loading, and shows the text after 1 second to avoid flicker', () => {
    renderWithProviders(<LoadingState label="Loading branches…" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading branches…');
    expect(screen.getByText('Loading branches…').className).toContain('sr-only');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Loading branches…').className).not.toContain('sr-only');
  });

  it('can show skeleton rows for lists and cards, marked busy', () => {
    renderWithProviders(<LoadingState label="Loading patients…" variant="skeleton" rows={4} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(4);
  });

  it('has no accessibility violations', async () => {
    vi.useRealTimers();
    const { container } = renderWithProviders(
      <>
        <LoadingState label="Loading…" />
        <LoadingState label="Loading list…" variant="skeleton" />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ErrorState', () => {
  it('is an alert with plain text and a Try again button', async () => {
    const onRetry = vi.fn();
    renderWithProviders(<ErrorState message="We could not load the branches." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load the branches.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides the retry button when there is nothing to retry', () => {
    renderWithProviders(<ErrorState message="Not allowed." />);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('puts the request id under "Details for support", with a Copy button that says it worked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // jsdom has no clipboard.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderWithProviders(<ErrorState message="Something went wrong." requestId="req-123" />);
    expect(screen.getByText('Details for support')).toBeInTheDocument();
    expect(screen.getByText(/req-123/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('req-123');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('has no support details without a request id', () => {
    renderWithProviders(<ErrorState message="Offline." />);
    expect(screen.queryByText('Details for support')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <ErrorState message="Something went wrong." requestId="req-9" onRetry={() => undefined} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
