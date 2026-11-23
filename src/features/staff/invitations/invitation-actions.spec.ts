import { describe, expect, it } from 'vitest';

import { invitationActions } from './invitation-actions.ts';

describe('invitationActions (docs/staff-management-integration.md 4.3)', () => {
  it.each(['pending', 'expired'] as const)(
    'a %s invitation can be sent again or revoked',
    (status) => {
      expect(invitationActions(status)).toEqual({ resend: true, revoke: true });
    },
  );

  it.each(['accepted', 'revoked'] as const)('a %s invitation has no buttons', (status) => {
    expect(invitationActions(status)).toEqual({ resend: false, revoke: false });
  });
});
