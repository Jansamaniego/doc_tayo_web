import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { TvPairingScreen } from './tv-pairing.tsx';

describe('TvPairingScreen (a display with no staff session)', () => {
  it('shows a large pairing code and says where to enter it', () => {
    renderWithProviders(<TvPairingScreen code="4F7-K2Q" />);
    expect(screen.getByText('4F7-K2Q')).toBeInTheDocument();
    expect(screen.getByText(/Enter this code in DocTayo/)).toBeInTheDocument();
    expect(screen.getByText('4F7-K2Q').className).toContain('text-tv-number');
  });

  it('has no sign-in form: staff never sign in on the TV', () => {
    const { container } = renderWithProviders(<TvPairingScreen code="4F7-K2Q" />);
    expect(container.querySelectorAll('input, form')).toHaveLength(0);
  });

  it('ends with one "Tap to enable sound" step, because browsers block audio until a tap', async () => {
    const onEnableSound = vi.fn();
    renderWithProviders(<TvPairingScreen code="4F7-K2Q" onEnableSound={onEnableSound} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tap to enable sound' }));
    expect(onEnableSound).toHaveBeenCalledTimes(1);
  });

  it('shows no sound button when sound is off or already allowed', () => {
    renderWithProviders(<TvPairingScreen code="4F7-K2Q" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <TvPairingScreen code="4F7-K2Q" onEnableSound={() => undefined} />,
    );
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
});
