import { useSyncExternalStore } from 'react';

import type { ApiError } from '../errors.ts';
import type { components } from '../schema';

export type Membership = components['schemas']['MembershipResponse'];

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
}

/** Why a person is looking at the sign-in page, so it can say so in plain words. */
export type SessionNotice =
  'inactive' | 'expired' | 'signed-out-elsewhere' | 'password-changed' | 'email-changed';

export type SessionState =
  /** The first refresh has not answered yet: show "Loading", never the sign-in page. */
  | { status: 'booting' }
  /** The API could not be reached at start (not the same as being signed out). */
  | { status: 'boot-failed'; error: ApiError }
  | { status: 'signed-out'; notice?: SessionNotice }
  | {
      status: 'signed-in';
      user: SessionUser;
      memberships: Membership[];
      /** Null until a clinic is chosen (several clinics, or none usable). */
      activeTenantId: string | null;
      /** Permission keys in the active clinic (GET /me). For menus and buttons only: the server enforces them. */
      permissions: string[];
      /** `platform_admin` shows the Clinics and Users tabs. It grants no access to any clinic's data. */
      platformRole: 'none' | 'platform_admin';
      /** Set when an admin took the active clinic away from this person; the picker says so until a clinic is chosen. */
      lostClinicName?: string;
    };

type Listener = () => void;

export interface SessionStore {
  get: () => SessionState;
  set: (next: SessionState) => void;
  subscribe: (listener: Listener) => () => void;
}

export function createSessionStore(): SessionStore {
  let state: SessionState = { status: 'booting' };
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set: (next) => {
      state = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** This tab's session. */
export const sessionStore = createSessionStore();

export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get);
}

/** The signed-in person changed their own name: the shell's user menu and the account page read it from here. */
export function updateSignedInUser(change: Pick<SessionUser, 'fullName'>): void {
  const state = sessionStore.get();
  if (state.status !== 'signed-in') return;
  sessionStore.set({ ...state, user: { ...state.user, ...change } });
}

/** The active clinic's id, or null with none. Clinic data is keyed by it so one clinic never shows another's. */
export function useActiveTenantId(): string | null {
  const session = useSession();
  return session.status === 'signed-in' ? session.activeTenantId : null;
}

export function activeMembership(session: SessionState): Membership | undefined {
  if (session.status !== 'signed-in' || session.activeTenantId === null) return undefined;
  return session.memberships.find((membership) => membership.tenantId === session.activeTenantId);
}

/** A clinic the person can open right now: their membership and the clinic are both active. */
export function isUsableMembership(membership: Membership): boolean {
  return membership.membershipStatus === 'active' && membership.tenantStatus === 'active';
}
