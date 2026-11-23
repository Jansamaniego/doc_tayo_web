import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/test/render.tsx';

import { AccountPage } from './AccountPage.tsx';

const props = {
  fullName: 'Ana Cruz',
  email: 'ana@example.com',
  clinicName: 'Sunrise Clinic',
  roleNames: ['Clinic admin'],
};

describe('AccountPage', () => {
  it('has one level-1 heading', () => {
    renderWithProviders(<AccountPage {...props} />);
    expect(screen.getByRole('heading', { level: 1, name: 'My account' })).toBeInTheDocument();
  });

  it("shows the person's name, email, clinic and role, as read-only information", () => {
    renderWithProviders(<AccountPage {...props} />);
    const info = screen.getByRole('region', { name: 'Your details' });
    expect(info).toHaveTextContent('Ana Cruz');
    expect(info).toHaveTextContent('ana@example.com');
    expect(info).toHaveTextContent('Sunrise Clinic');
    expect(info).toHaveTextContent('Clinic admin');
    expect(info.querySelector('input')).toBeNull();
  });

  it('says why the details cannot be edited here', () => {
    renderWithProviders(<AccountPage {...props} />);
    expect(screen.getByText(/ask your clinic admin/i)).toBeInTheDocument();
  });

  it('has the change-password form in its own labelled section', () => {
    renderWithProviders(<AccountPage {...props} />);
    const section = screen.getByRole('region', { name: 'Change password' });
    expect(section).toContainElement(screen.getByLabelText('Current password'));
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<AccountPage {...props} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
