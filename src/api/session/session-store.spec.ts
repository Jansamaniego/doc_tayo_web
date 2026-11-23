import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  activeMembership,
  sessionStore,
  type Membership,
  type SessionState,
} from './session-store.ts';

afterEach(() => {
  sessionStore.set({ status: 'booting' });
});

const MEMBERSHIPS: Membership[] = [
  {
    tenantId: 'a',
    tenantName: 'Sunrise Clinic',
    tenantStatus: 'active',
    membershipStatus: 'active',
    roles: [{ key: 'owner', name: 'Owner' }],
  },
  {
    tenantId: 'b',
    tenantName: 'Harbor Clinic',
    tenantStatus: 'suspended',
    membershipStatus: 'active',
    roles: [],
  },
];

function signedIn(activeTenantId: string | null): SessionState {
  return {
    status: 'signed-in',
    user: { id: 'u', email: 'ana@example.com', fullName: 'Ana Cruz' },
    memberships: [...MEMBERSHIPS],
    activeTenantId,
    permissions: ['tenant.read'],
  };
}

describe('sessionStore', () => {
  it('starts booting: the app must not decide anything before the first refresh answers', () => {
    expect(sessionStore.get()).toEqual({ status: 'booting' });
  });

  it('holds the state and tells subscribers when it changes', () => {
    const listener = vi.fn();
    const off = sessionStore.subscribe(listener);
    sessionStore.set({ status: 'signed-out' });
    expect(sessionStore.get()).toEqual({ status: 'signed-out' });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    sessionStore.set({ status: 'booting' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('activeMembership', () => {
  it('finds the clinic the session is using', () => {
    expect(activeMembership(signedIn('a'))?.tenantName).toBe('Sunrise Clinic');
  });

  it('is undefined with no active clinic, an unknown one, or when not signed in', () => {
    expect(activeMembership(signedIn(null))).toBeUndefined();
    expect(activeMembership(signedIn('zzz'))).toBeUndefined();
    expect(activeMembership({ status: 'signed-out' })).toBeUndefined();
    expect(activeMembership({ status: 'booting' })).toBeUndefined();
  });
});
