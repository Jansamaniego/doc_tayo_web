import type { InvitationStatus } from '../api/invitations.ts';

/**
 * Which buttons an invitation row offers (docs/staff-management-integration.md 4.3). Revoking an
 * expired invitation frees the address for a new one, so it stays offered. The server decides.
 */
export function invitationActions(status: InvitationStatus): { resend: boolean; revoke: boolean } {
  const open = status === 'pending' || status === 'expired';
  return { resend: open, revoke: open };
}
