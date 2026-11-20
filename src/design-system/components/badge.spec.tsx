import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { StatusPill } from './badge.tsx';

describe('StatusPill', () => {
  it.each(['success', 'warning', 'danger', 'info', 'neutral'] as const)(
    '%s shows an icon and a word, never colour alone',
    (status) => {
      const { container } = renderWithProviders(
        <StatusPill status={status}>Checked in</StatusPill>,
      );
      expect(screen.getByText('Checked in')).toBeInTheDocument();
      expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    },
  );

  it('looks different for each status', () => {
    const seen = new Set<string>();
    for (const status of ['success', 'warning', 'danger', 'info', 'neutral'] as const) {
      const { container, unmount } = renderWithProviders(
        <StatusPill status={status}>X</StatusPill>,
      );
      seen.add(container.firstElementChild?.className ?? '');
      unmount();
    }
    expect(seen.size).toBe(5);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <>
        <StatusPill status="success">Checked in</StatusPill>
        <StatusPill status="warning">Waiting</StatusPill>
        <StatusPill status="danger">Cancelled</StatusPill>
        <StatusPill status="info">Booked</StatusPill>
        <StatusPill status="neutral">Archived</StatusPill>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
