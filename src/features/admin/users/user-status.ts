import type { UserStatus } from '../api/admin-users.ts';

export interface UserAction {
  id: 'deactivate' | 'reactivate';
  /** The status sent to the API. */
  target: 'deactivated' | 'active';
}

/**
 * The one status change an admin may make to an account, or none: a pending account activates itself
 * from its emailed link (the API answers 409), and nobody changes their own status (403).
 */
export function userAction({
  status,
  isSelf,
}: {
  status: UserStatus;
  isSelf: boolean;
}): UserAction | undefined {
  if (isSelf) return undefined;
  if (status === 'active') return { id: 'deactivate', target: 'deactivated' };
  if (status === 'deactivated') return { id: 'reactivate', target: 'active' };
  return undefined;
}
