import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/errors.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { RouteErrorPage } from './RouteErrorPage.tsx';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

const apiError = new ApiError({
  status: 403,
  code: 'TENANT_SUSPENDED',
  message: 'server text',
  details: [],
  requestId: 'req-42',
});

describe('RouteErrorPage', () => {
  it('shows plain-language text for an API error, never the technical code', () => {
    renderWithProviders(<RouteErrorPage error={apiError} reset={() => undefined} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText("This clinic's access is suspended for now.")).toBeInTheDocument();
    expect(screen.queryByText(/TENANT_SUSPENDED/)).not.toBeInTheDocument();
  });

  it('gives support the request id', () => {
    renderWithProviders(<RouteErrorPage error={apiError} reset={() => undefined} />);
    expect(screen.getByText('Details for support')).toBeInTheDocument();
    expect(screen.getByText(/req-42/)).toBeInTheDocument();
  });

  it('shows a generic message and no support details for an unexpected error', () => {
    renderWithProviders(
      <RouteErrorPage error={new Error('boom: internal detail')} reset={() => undefined} />,
    );
    expect(screen.getByText('Please try again.')).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
    expect(screen.queryByText('Details for support')).not.toBeInTheDocument();
  });

  it('calls reset when Try again is pressed', async () => {
    const reset = vi.fn();
    renderWithProviders(<RouteErrorPage error={apiError} reset={reset} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <RouteErrorPage error={apiError} reset={() => undefined} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
