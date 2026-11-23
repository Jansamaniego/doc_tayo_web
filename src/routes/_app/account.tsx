import { createFileRoute } from '@tanstack/react-router';

import { activeMembership, useSession } from '@/api/session/session-store.ts';
import { AccountPage } from '@/features/account/AccountPage.tsx';

function Account() {
  const session = useSession();
  if (session.status !== 'signed-in') return null;
  const membership = activeMembership(session);
  return (
    <AccountPage
      fullName={session.user.fullName}
      email={session.user.email}
      clinicName={membership?.tenantName ?? ''}
      roleNames={membership?.roles.map((role) => role.name) ?? []}
    />
  );
}

export const Route = createFileRoute('/_app/account')({ component: Account });
