import type { ReactNode } from 'react';

import { useSession } from '@/api/session/session-store.ts';
import { NoAccess } from '@/design-system/patterns/permission.tsx';
import { can } from '@/lib/permissions.ts';

/**
 * A clinic page that needs a permission. Without it the page shows "you don't have access" and its
 * children never render, so they never ask the server for the data. The server enforces it anyway.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const session = useSession();
  if (session.status !== 'signed-in') return null;
  return can(session.permissions, permission) ? children : <NoAccess />;
}
