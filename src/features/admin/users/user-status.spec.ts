import { describe, expect, it } from 'vitest';

import { userAction } from './user-status.ts';

describe('userAction (what an admin may do to an account)', () => {
  it('lets an active account be deactivated', () => {
    expect(userAction({ status: 'active', isSelf: false })).toEqual({
      id: 'deactivate',
      target: 'deactivated',
    });
  });

  it('lets a deactivated account be reactivated', () => {
    expect(userAction({ status: 'deactivated', isSelf: false })).toEqual({
      id: 'reactivate',
      target: 'active',
    });
  });

  it('offers nothing for a pending account: the person activates it from their own emailed link', () => {
    expect(userAction({ status: 'pending', isSelf: false })).toBeUndefined();
  });

  it('offers nothing on your own account', () => {
    expect(userAction({ status: 'active', isSelf: true })).toBeUndefined();
    expect(userAction({ status: 'deactivated', isSelf: true })).toBeUndefined();
  });
});
