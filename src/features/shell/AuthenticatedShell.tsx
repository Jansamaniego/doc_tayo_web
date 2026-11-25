import { useLingui } from '@lingui/react/macro';
import { Outlet, useRouter, useRouterState } from '@tanstack/react-router';
import {
  ContactRound,
  Building2,
  Hospital,
  House,
  LayoutDashboard,
  Users,
  UsersRound,
} from 'lucide-react';
import { useState } from 'react';

import { messageForError } from '@/api/error-messages.ts';
import { isApiError, networkError, type ApiError } from '@/api/errors.ts';
import { activeMembership, useSession } from '@/api/session/session-store.ts';
import { Alert } from '@/design-system/components/alert.tsx';
import { ConfirmDialog } from '@/design-system/components/confirm-dialog.tsx';
import {
  AppShell,
  type NavItem,
  type RenderLinkProps,
} from '@/design-system/patterns/app-shell.tsx';
import { ClinicSwitcher } from '@/design-system/patterns/clinic-switcher.tsx';
import { UserMenu } from '@/design-system/patterns/user-menu.tsx';
import { useSessionController } from '@/features/auth/session-context.tsx';
import { useSpaClick } from '@/lib/app-link.tsx';

// A brand name is not translated.
const PRODUCT_NAME = 'DocTayo';

function RouterNavLink({ href, className, children, current }: RenderLinkProps) {
  const onClick = useSpaClick({ href });
  return (
    <a
      href={href}
      className={className}
      aria-current={current ? 'page' : undefined}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

/** The frame around every page inside a clinic: navigation, the clinic, and the person's menu. */
export function AuthenticatedShell() {
  const { t } = useLingui();
  const session = useSession();
  const controller = useSessionController();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [confirmingSignOutAll, setConfirmingSignOutAll] = useState(false);
  const [switchFailure, setSwitchFailure] = useState<ApiError | undefined>();

  if (session.status !== 'signed-in') return null;
  const membership = activeMembership(session);

  const isAdmin = session.platformRole === 'platform_admin';
  // Clinic pages (only with a clinic chosen) first, then the platform tabs. Home, Staff and Clinic
  // so far; each later phase adds its items here, with the permission key that shows it.
  const items: NavItem[] = [
    ...(membership
      ? [
          {
            id: 'home',
            label: t`Home`,
            icon: <House aria-hidden="true" className="size-6" />,
            href: '/',
          },
          {
            id: 'patients',
            label: t`Patients`,
            icon: <ContactRound aria-hidden="true" className="size-6" />,
            href: '/patients',
            requires: 'patients.read',
          },
          {
            id: 'staff',
            label: t`Staff`,
            icon: <UsersRound aria-hidden="true" className="size-6" />,
            href: '/staff',
            requires: 'members.read',
          },
          {
            id: 'clinic',
            label: t`Clinic`,
            icon: <Hospital aria-hidden="true" className="size-6" />,
            href: '/clinic',
            requires: 'tenant.read',
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            id: 'admin-overview',
            label: t`Overview`,
            icon: <LayoutDashboard aria-hidden="true" className="size-6" />,
            href: '/admin',
          },
          {
            id: 'admin-clinics',
            label: t`Clinics`,
            icon: <Building2 aria-hidden="true" className="size-6" />,
            href: '/admin/clinics',
          },
          {
            id: 'admin-users',
            label: t`Users`,
            icon: <Users aria-hidden="true" className="size-6" />,
            href: '/admin/users',
          },
        ]
      : []),
  ];
  const currentId = pathname.startsWith('/admin/users')
    ? 'admin-users'
    : pathname.startsWith('/admin/clinics')
      ? 'admin-clinics'
      : pathname.startsWith('/admin')
        ? 'admin-overview'
        : pathname.startsWith('/patients')
          ? 'patients'
          : pathname.startsWith('/staff')
            ? 'staff'
            : pathname.startsWith('/clinic')
              ? 'clinic'
              : pathname === '/'
                ? 'home'
                : '';

  return (
    <AppShell
      items={items}
      permissions={session.permissions}
      currentId={currentId}
      renderLink={(props) => <RouterNavLink {...props} />}
      clinic={
        membership ? (
          <ClinicSwitcher
            clinics={session.memberships
              .filter((m) => m.membershipStatus === 'active')
              .map((m) => ({ id: m.tenantId, name: m.tenantName, status: m.tenantStatus }))}
            currentId={membership.tenantId}
            onSelect={(tenantId) => {
              setSwitchFailure(undefined);
              controller.switchClinic(tenantId).catch((error: unknown) => {
                setSwitchFailure(isApiError(error) ? error : networkError(error));
              });
            }}
          />
        ) : (
          <span className="font-bold">{PRODUCT_NAME}</span>
        )
      }
      user={
        <UserMenu
          name={session.user.fullName}
          onAccount={() => {
            void router.navigate({ to: '/account' });
          }}
          onSignOut={() => {
            void controller.signOut();
          }}
          onSignOutEverywhere={() => {
            setConfirmingSignOutAll(true);
          }}
        />
      }
    >
      {switchFailure && (
        <div className="mb-6">
          <Alert variant="danger">{messageForError(switchFailure)}</Alert>
        </div>
      )}
      <Outlet />
      <ConfirmDialog
        open={confirmingSignOutAll}
        onOpenChange={setConfirmingSignOutAll}
        title={t`Sign out on all devices?`}
        description={t`Every computer, phone and browser where you are signed in will be signed out.`}
        confirmLabel={t`Sign out everywhere`}
        destructive={false}
        onConfirm={() => {
          void controller.signOutEverywhere();
        }}
      />
    </AppShell>
  );
}
