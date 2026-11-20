import type { Meta, StoryObj } from '@storybook/react-vite';
import { Building2, Calendar, ClipboardList, Home, Settings, UserRound, Users } from 'lucide-react';

import { Button } from '@/design-system/components/button.tsx';

import { AppShell, type NavItem } from './app-shell.tsx';
import { ClinicSwitcher } from './clinic-switcher.tsx';
import { PageHeader } from './page-header.tsx';
import { UserMenu } from './user-menu.tsx';

const meta: Meta = {
  title: 'Patterns/App shell',
  parameters: { layout: 'fullscreen', docs: { story: { inline: false, iframeHeight: 560 } } },
};
export default meta;
type Story = StoryObj;

const ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: <Home />, href: '/' },
  { id: 'patients', label: 'Patients', icon: <UserRound />, href: '/patients' },
  { id: 'appointments', label: 'Appointments', icon: <Calendar />, href: '/appointments' },
  { id: 'billing', label: 'Billing', icon: <ClipboardList />, href: '/billing' },
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

const clinic = (
  <ClinicSwitcher
    clinics={[
      { id: 'a', name: 'Sunrise Clinic', status: 'active' },
      { id: 'b', name: 'Harbor Clinic', status: 'active' },
      { id: 'c', name: 'Old Town Clinic', status: 'suspended' },
    ]}
    currentId="a"
    onSelect={() => undefined}
  />
);
const user = (
  <UserMenu
    name="Ana Cruz"
    onAccount={() => undefined}
    onSignOut={() => undefined}
    onSignOutEverywhere={() => undefined}
  />
);
const page = (
  <PageHeader
    title="Branches"
    breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Branches' }]}
    primaryAction={<Button>Add branch</Button>}
    moreActions={[{ label: 'Export list', onSelect: () => undefined }]}
  />
);

function shell(layout: 'desktop' | 'tablet' | 'mobile', permissions: string[]) {
  return (
    <AppShell
      items={ITEMS}
      permissions={permissions}
      currentId="branches"
      layout={layout}
      clinic={clinic}
      user={user}
    >
      {page}
    </AppShell>
  );
}

export const DesktopOwner: Story = { render: () => shell('desktop', OWNER) };
export const DesktopReceptionist: Story = { render: () => shell('desktop', RECEPTIONIST) };
export const TabletOwner: Story = { render: () => shell('tablet', OWNER) };
export const MobileOwner: Story = { render: () => shell('mobile', OWNER) };
export const MobileReceptionist: Story = { render: () => shell('mobile', RECEPTIONIST) };
