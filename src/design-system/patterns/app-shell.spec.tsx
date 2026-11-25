import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Building2, Home, Settings, Users, Calendar, ClipboardList, UserRound } from 'lucide-react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/render.tsx';

import { AppShell, type NavItem } from './app-shell.tsx';

const ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: <Home />, href: '/' },
  {
    id: 'branches',
    label: 'Branches',
    icon: <Building2 />,
    href: '/branches',
    requires: 'branches.read',
  },
  { id: 'staff', label: 'Staff', icon: <Users />, href: '/staff', requires: 'members.invite' },
  {
    id: 'settings',
    label: 'Clinic settings',
    icon: <Settings />,
    href: '/settings',
    requires: 'tenant.settings.manage',
  },
];

const OWNER = [
  'tenant.read',
  'tenant.settings.manage',
  'branches.read',
  'branches.manage',
  'members.invite',
];
const RECEPTIONIST = ['tenant.read', 'branches.read'];

function renderShell(props: Partial<Parameters<typeof AppShell>[0]> = {}) {
  return renderWithProviders(
    <AppShell
      items={ITEMS}
      permissions={OWNER}
      currentId="home"
      layout="desktop"
      clinic={<span>Sunrise Clinic</span>}
      user={<span>Ana Cruz</span>}
      {...props}
    >
      <h1>Home</h1>
    </AppShell>,
  );
}

describe('AppShell on desktop (side navigation)', () => {
  it('has the landmarks: a main navigation and the main content', () => {
    renderShell();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Home');
    expect(screen.getByRole('banner')).toHaveTextContent('Sunrise Clinic');
    expect(screen.getByRole('banner')).toHaveTextContent('Ana Cruz');
  });

  it('shows every item with an icon AND a label, never icons alone', () => {
    const { container } = renderShell();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const label of ['Home', 'Branches', 'Staff', 'Clinic settings']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(container.querySelectorAll('nav svg[aria-hidden="true"]').length).toBe(4);
  });

  it('shows the current page by aria-current, bold text and a bar, not colour alone', () => {
    renderShell({ currentId: 'branches' });
    const current = screen.getByRole('link', { name: 'Branches' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.className).toContain('font-bold');
    expect(current.className).toContain('border-l-4');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('hides what the person cannot use (a receptionist sees no Staff or Clinic settings)', () => {
    renderShell({ permissions: RECEPTIONIST });
    expect(screen.getByRole('link', { name: 'Branches' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clinic settings' })).not.toBeInTheDocument();
  });

  it('shows items without a requirement to everyone, even with no permissions', () => {
    renderShell({ permissions: [] });
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Branches' })).not.toBeInTheDocument();
  });

  it('keeps every link at least 44 px high', () => {
    renderShell();
    for (const link of within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole(
      'link',
    )) {
      expect(link.className).toContain('min-h-target');
    }
  });

  it('can render links through the router instead of plain anchors', () => {
    renderShell({
      renderLink: ({ href, className, children, current }) => (
        <a
          data-router="yes"
          href={href}
          className={className}
          aria-current={current ? 'page' : undefined}
        >
          {children}
        </a>
      ),
    });
    expect(screen.getByRole('link', { name: 'Branches' })).toHaveAttribute('data-router', 'yes');
  });

  it('has no accessibility violations (owner and receptionist)', async () => {
    const owner = renderShell();
    expect(await axe(owner.container)).toHaveNoViolations();
    owner.unmount();
    const receptionist = renderShell({ permissions: RECEPTIONIST });
    expect(await axe(receptionist.container)).toHaveNoViolations();
  });
});

describe('AppShell on tablet (top bar and a labelled Menu)', () => {
  it('has a "Menu" button with a word, and the navigation only when it is open', async () => {
    renderShell({ layout: 'tablet' });
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    await userEvent.click(menu);
    const dialog = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(dialog).getByRole('link', { name: 'Branches' })).toBeInTheDocument();
  });

  it('has no accessibility violations, closed and open', async () => {
    const { container } = renderShell({ layout: 'tablet' });
    expect(await axe(container)).toHaveNoViolations();
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await screen.findByRole('dialog');
    expect(
      await axe(document.body, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });
});

describe('AppShell on mobile (bottom tab bar)', () => {
  const MANY: NavItem[] = [
    ...ITEMS,
    { id: 'patients', label: 'Patients', icon: <UserRound />, href: '/patients' },
    { id: 'appointments', label: 'Appointments', icon: <Calendar />, href: '/appointments' },
    { id: 'billing', label: 'Billing', icon: <ClipboardList />, href: '/billing' },
  ];

  it('shows at most 5 labelled items; with more, the rest go behind "More"', async () => {
    renderShell({ layout: 'mobile', items: MANY });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
    const more = within(nav).getByRole('button', { name: 'More' });
    await userEvent.click(more);
    const dialog = await screen.findByRole('dialog', { name: 'More' });
    expect(within(dialog).getByRole('link', { name: 'Billing' })).toBeInTheDocument();
  });

  it('shows every item and no "More" when they all fit', () => {
    renderShell({ layout: 'mobile' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
    expect(within(nav).queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
  });

  it('keeps each tab labelled and at least 44 px', () => {
    renderShell({ layout: 'mobile' });
    for (const link of within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole(
      'link',
    )) {
      expect(link.className).toContain('min-h-target');
      expect(link.textContent.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no accessibility violations', async () => {
    const { container } = renderShell({ layout: 'mobile', items: MANY });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('AppShell: changing the screen width keeps the page', () => {
  const shell = (layout: 'desktop' | 'tablet' | 'mobile') => (
    <AppShell
      items={ITEMS}
      permissions={OWNER}
      currentId="home"
      layout={layout}
      clinic={<span>Sunrise Clinic</span>}
      user={<span>Ana Cruz</span>}
    >
      <input aria-label="Typed" />
    </AppShell>
  );

  it.each([
    ['desktop', 'tablet'],
    ['desktop', 'mobile'],
    ['tablet', 'mobile'],
    ['mobile', 'desktop'],
  ] as const)(
    'from %s to %s keeps what was typed (turning a tablet must not empty a form)',
    async (from, to) => {
      const view = renderWithProviders(shell(from));
      await userEvent.type(screen.getByLabelText('Typed'), 'half a patient');
      view.rerender(shell(to));
      expect(screen.getByLabelText('Typed')).toHaveValue('half a patient');
    },
  );
});
