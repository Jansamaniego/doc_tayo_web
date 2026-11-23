import { createFileRoute } from '@tanstack/react-router';

import { activeMembership, useSession } from '@/api/session/session-store.ts';
import { HomePage } from '@/features/home/HomePage.tsx';

function Home() {
  const session = useSession();
  if (session.status !== 'signed-in') return null;
  return (
    <HomePage
      fullName={session.user.fullName}
      clinicName={activeMembership(session)?.tenantName ?? ''}
    />
  );
}

export const Route = createFileRoute('/_app/_clinic/')({ component: Home });
