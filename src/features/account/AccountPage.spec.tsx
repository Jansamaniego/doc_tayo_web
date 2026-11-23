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

  it('shows the email, clinic and role as read-only information', () => {
    renderWithProviders(<AccountPage {...props} />);
    const info = screen.getByRole('region', { name: 'Your details' });
    expect(info).toHaveTextContent('ana@example.com');
    expect(info).toHaveTextContent('Sunrise Clinic');
    expect(info).toHaveTextContent('Clinic admin');
    expect(info.querySelector('input')).toBeNull();
  });

  it('lets the person change their own name, in its own labelled section', () => {
    renderWithProviders(<AccountPage {...props} />);
    const section = screen.getByRole('region', { name: 'Your name' });
    expect(section).toContainElement(screen.getByLabelText('Name'));
    expect(screen.getByLabelText('Name')).toHaveValue('Ana Cruz');
  });

  it('lets the person change their email, in its own labelled section', () => {
    renderWithProviders(<AccountPage {...props} />);
    const section = screen.getByRole('region', { name: 'Change email' });
    expect(section).toContainElement(screen.getByLabelText('New email'));
  });

  it('no longer tells the person to ask their clinic admin', () => {
    renderWithProviders(<AccountPage {...props} />);
    expect(screen.queryByText(/ask your clinic admin/i)).not.toBeInTheDocument();
  });

  it('has the change-password form in its own labelled section', () => {
    renderWithProviders(<AccountPage {...props} />);
    const section = screen.getByRole('region', { name: 'Change password' });
    expect(section).toContainElement(screen.getByLabelText('Current password'));
  });

  it('leaves out the clinic and role when the person has no clinic selected (a platform admin)', () => {
    renderWithProviders(<AccountPage {...props} clinicName="" roleNames={[]} />);
    const info = screen.getByRole('region', { name: 'Your details' });
    expect(info).toHaveTextContent('ana@example.com');
    expect(info).not.toHaveTextContent('Clinic');
    expect(info).not.toHaveTextContent('Role');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<AccountPage {...props} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
