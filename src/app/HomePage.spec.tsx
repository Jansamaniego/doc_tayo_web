import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/msw/server.ts';
import { renderWithProviders } from '@/test/render.tsx';

import { HomePage } from './HomePage.tsx';

const HEALTH = 'http://localhost:3000/api/health';

describe('HomePage', () => {
  it('has one level-1 heading with the product name', async () => {
    server.use(http.get(HEALTH, () => HttpResponse.json({ status: 'ok' })));
    renderWithProviders(<HomePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'DocTayo' })).toBeInTheDocument();
    await screen.findByText('API reachable');
  });

  it('says it is checking while the request is in flight', async () => {
    server.use(http.get(HEALTH, () => HttpResponse.json({ status: 'ok' })));
    renderWithProviders(<HomePage />);
    expect(screen.getByRole('status')).toHaveTextContent('Checking the connection');
    await screen.findByText('API reachable');
  });

  it('shows "API reachable" when the health check answers 200', async () => {
    server.use(http.get(HEALTH, () => HttpResponse.json({ status: 'ok' })));
    renderWithProviders(<HomePage />);
    expect(await screen.findByText('API reachable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('shows "API not reachable" with a Try again button on a 503', async () => {
    server.use(
      http.get(HEALTH, () =>
        HttpResponse.json(
          { error: { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'x', requestId: 'req-1' } },
          { status: 503 },
        ),
      ),
    );
    renderWithProviders(<HomePage />);
    expect(await screen.findByText('API not reachable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    // The request id lets a user quote the failure to support.
    expect(screen.getByText(/req-1/)).toBeInTheDocument();
  });

  it('shows "API not reachable" when the network fails', async () => {
    server.use(http.get(HEALTH, () => HttpResponse.error()));
    renderWithProviders(<HomePage />);
    expect(await screen.findByText('API not reachable')).toBeInTheDocument();
  });

  it('checks again when Try again is pressed, and recovers', async () => {
    let calls = 0;
    server.use(
      http.get(HEALTH, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { error: { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'x', requestId: 'r' } },
              { status: 503 },
            )
          : HttpResponse.json({ status: 'ok' });
      }),
    );
    renderWithProviders(<HomePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('API reachable')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  describe('accessibility', () => {
    it('has no violations while checking and once reachable', async () => {
      server.use(http.get(HEALTH, () => HttpResponse.json({ status: 'ok' })));
      const { container } = renderWithProviders(<HomePage />);
      expect(await axe(container)).toHaveNoViolations();
      await screen.findByText('API reachable');
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no violations when the API is not reachable', async () => {
      server.use(
        http.get(HEALTH, () =>
          HttpResponse.json(
            {
              error: { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'x', requestId: 'req-2' },
            },
            { status: 503 },
          ),
        ),
      );
      const { container } = renderWithProviders(<HomePage />);
      await screen.findByText('API not reachable');
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
