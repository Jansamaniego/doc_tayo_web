import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { Alert } from './alert.tsx';

afterEach(() => {
  vi.useRealTimers();
});

describe('Alert', () => {
  it.each([
    ['success', 'Success', 'status'],
    ['info', 'Information', 'status'],
    ['warning', 'Warning', 'status'],
    ['danger', 'Error', 'alert'],
  ] as const)('%s has a word, an icon and the right live-region role', (variant, word, role) => {
    const { container } = renderWithProviders(<Alert variant={variant}>Something happened.</Alert>);
    expect(screen.getByRole(role)).toHaveTextContent(word);
    expect(screen.getByRole(role)).toHaveTextContent('Something happened.');
    // Never colour alone: an icon (decorative) AND a word.
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows an optional title as a strong first line', () => {
    renderWithProviders(
      <Alert variant="warning" title="You are offline">
        Changes are not saved.
      </Alert>,
    );
    expect(screen.getByText('You are offline')).toBeInTheDocument();
  });

  it('can be dismissed with a labelled Close button, and says so to the parent', async () => {
    const onDismiss = vi.fn();
    renderWithProviders(
      <Alert variant="danger" onDismiss={onDismiss}>
        We could not save.
      </Alert>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has no Close button unless the parent can dismiss it', () => {
    renderWithProviders(<Alert variant="info">Hello.</Alert>);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('stays on the page: it never dismisses itself, however long it is shown', () => {
    vi.useFakeTimers();
    renderWithProviders(<Alert variant="danger">We could not save.</Alert>);
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('can hold an action such as Try again', async () => {
    const retry = vi.fn();
    renderWithProviders(
      <Alert variant="danger" action={<button onClick={retry}>Try again</button>}>
        Failed.
      </Alert>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('has no accessibility violations in any variant', async () => {
    const { container } = renderWithProviders(
      <>
        <Alert variant="success">Saved.</Alert>
        <Alert variant="info" title="Note">
          Info.
        </Alert>
        <Alert variant="warning" onDismiss={() => undefined}>
          Careful.
        </Alert>
        <Alert variant="danger" onDismiss={() => undefined}>
          Error.
        </Alert>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
    render(<span />);
  });
});
