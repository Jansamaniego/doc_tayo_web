import { screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { HomePage } from './HomePage.tsx';

describe('HomePage', () => {
  it('welcomes the person by name and names the clinic', () => {
    renderWithProviders(<HomePage fullName="Ana Cruz" clinicName="Sunrise Clinic" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome, Ana' })).toBeInTheDocument();
    expect(screen.getByText('Sunrise Clinic')).toBeInTheDocument();
  });

  it('has a "Today" overview with three labelled figures', () => {
    renderWithProviders(<HomePage fullName="Ana Cruz" clinicName="Sunrise Clinic" />);
    const today = screen.getByRole('region', { name: 'Today at a glance' });
    for (const label of ['Appointments', 'Waiting now', 'Seen today']) {
      expect(today).toHaveTextContent(label);
    }
  });

  it('has a getting-started list in steps', () => {
    renderWithProviders(<HomePage fullName="Ana Cruz" clinicName="Sunrise Clinic" />);
    const steps = screen.getByRole('list', { name: 'Getting started' });
    expect(steps.querySelectorAll('li').length).toBeGreaterThanOrEqual(3);
  });

  it('never promises features with "coming soon"', () => {
    const { container } = renderWithProviders(
      <HomePage fullName="Ana Cruz" clinicName="Sunrise Clinic" />,
    );
    expect(container.textContent).not.toMatch(/coming soon/i);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(
      <HomePage fullName="Ana Cruz" clinicName="Sunrise Clinic" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
