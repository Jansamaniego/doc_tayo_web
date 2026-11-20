import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { MisconfiguredPage } from './MisconfiguredPage.tsx';

describe('MisconfiguredPage', () => {
  it('explains the problem and lists the names of the bad settings', () => {
    renderWithProviders(<MisconfiguredPage invalidKeys={['VITE_API_ORIGIN', 'VITE_APP_ENV']} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'This app is misconfigured' }),
    ).toBeInTheDocument();
    expect(screen.getByText('VITE_API_ORIGIN')).toBeInTheDocument();
    expect(screen.getByText('VITE_APP_ENV')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <MisconfiguredPage invalidKeys={['VITE_API_ORIGIN']} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
