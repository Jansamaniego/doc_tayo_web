import { writePreference } from '@/lib/preferences.ts';

import type { ApiClient } from '../client.ts';
import { ApiError, isApiError, networkError } from '../errors.ts';
import type { SessionNotice, SessionStore } from './session-store.ts';
import { createTabSync, type TabMessage } from './tab-sync.ts';
import type { TokenStore } from './token-store.ts';

export type SessionEvent =
  | { type: 'signed-out' }
  /** The active clinic changed: clear everything cached for the old one. */
  | { type: 'clinic-changed'; fromOtherTab: boolean; tenantName: string | undefined }
  /** An admin suspended or removed the person from the active clinic: clear what was cached for it. */
  | { type: 'clinic-lost' };

export interface SessionControllerDeps {
  client: ApiClient;
  /** Gets a new access token (single-flight, see refresh.ts). */
  refresh: () => Promise<string>;
  tokens: TokenStore;
  store: SessionStore;
  tabSyncName?: string;
}

export interface SessionController {
  /** The first thing the app does: restore the session from the refresh cookie. */
  boot: () => Promise<void>;
  signIn: (credentials: {
    email: string;
    password: string;
    sharedComputer: boolean;
  }) => Promise<void>;
  signOut: (options?: { notice?: SessionNotice }) => Promise<void>;
  signOutEverywhere: () => Promise<void>;
  /** The server says the session is over. */
  endSession: (notice: SessionNotice) => Promise<void>;
  switchClinic: (tenantId: string) => Promise<void>;
  /** After a 403 the permissions may have changed: ask again who the person is and what they may do. */
  refreshPermissions: () => Promise<void>;
  subscribe: (listener: (event: SessionEvent) => void) => () => void;
  /** Stops listening to the other tabs. */
  close: () => void;
}

/**
 * Everything about who is signed in: boot, sign-in, sign-out, clinic switching and what the other
 * tabs say. The access token and the state live in memory (docs/frontend-integration.md §4); the
 * server session is shared by all tabs, so a sign-out or a clinic switch is broadcast.
 */
export function createSessionController({
  client,
  refresh,
  tokens,
  store,
  tabSyncName,
}: SessionControllerDeps): SessionController {
  const listeners = new Set<(event: SessionEvent) => void>();
  const emit = (event: SessionEvent): void => {
    for (const listener of listeners) listener(event);
  };

  /** Who the person is, which clinics they belong to, and what they may do in the active one. */
  async function loadSession(): Promise<void> {
    const [me, memberships] = await Promise.all([
      client.GET('/api/v1/me'),
      client.GET('/api/v1/me/memberships'),
    ]);
    if (!me.data || !memberships.data) throw networkError(new Error('Empty answer.'));
    const { id, email, fullName, activeTenantId, permissions, platformRole } = me.data.data;
    const { practitionerProfileId } = me.data.data;

    // The server clears the active clinic when an admin suspends or removes the person (their next
    // request says so), so a clinic that was open and now is not means it was taken away.
    const before = store.get();
    const hadActiveClinic = before.status === 'signed-in' && before.activeTenantId !== null;
    const isClinicLost = hadActiveClinic && activeTenantId === null;
    const lostClinicName = isClinicLost
      ? before.memberships.find((membership) => membership.tenantId === before.activeTenantId)
          ?.tenantName
      : before.status === 'signed-in' && activeTenantId === null
        ? before.lostClinicName
        : undefined;

    store.set({
      status: 'signed-in',
      user: { id, email, fullName },
      memberships: memberships.data.data,
      activeTenantId,
      permissions,
      platformRole,
      practitionerProfileId,
      ...(lostClinicName !== undefined && { lostClinicName }),
    });
    if (isClinicLost) emit({ type: 'clinic-lost' });
  }

  function endLocally(notice?: SessionNotice): void {
    if (store.get().status === 'signed-out') return;
    tokens.clear();
    store.set({ status: 'signed-out', ...(notice && { notice }) });
    emit({ type: 'signed-out' });
  }

  const tabSync = createTabSync({
    ...(tabSyncName && { name: tabSyncName }),
    onMessage: (message: TabMessage) => {
      if (message.type === 'signed-out') {
        endLocally('signed-out-elsewhere');
      } else if (message.type === 'clinic-switched') {
        // A tab that is not signed in has no token: asking who it is would end its "session" and
        // sign the tab that switched out.
        if (store.get().status !== 'signed-in') return;
        void loadSession().then(
          () => {
            const state = store.get();
            const tenantName =
              state.status === 'signed-in'
                ? state.memberships.find((membership) => membership.tenantId === message.tenantId)
                    ?.tenantName
                : undefined;
            emit({ type: 'clinic-changed', fromOtherTab: true, tenantName });
          },
          () => undefined,
        );
      }
    },
  });

  async function boot(): Promise<void> {
    store.set({ status: 'booting' });
    try {
      await refresh();
      await loadSession();
    } catch (error) {
      if (store.get().status === 'signed-out') return;
      if (isApiError(error) && (error.status === 401 || error.status === 403)) {
        tokens.clear();
        store.set({ status: 'signed-out' });
        return;
      }
      store.set({ status: 'boot-failed', error: isApiError(error) ? error : networkError(error) });
    }
  }

  async function signIn({
    email,
    password,
    sharedComputer,
  }: {
    email: string;
    password: string;
    sharedComputer: boolean;
  }): Promise<void> {
    const login = await client.POST('/api/v1/auth/login', { body: { email, password } });
    if (!login.data) throw networkError(new Error('Empty answer.'));
    tokens.set(login.data.data.accessToken);
    try {
      await loadSession();
    } catch (error) {
      tokens.clear();
      throw error;
    }
    writePreference('sharedComputer', sharedComputer);
  }

  async function revokeOnServer(
    path: '/api/v1/auth/logout' | '/api/v1/auth/logout-all',
  ): Promise<void> {
    if (tokens.get() === null) return;
    try {
      await client.POST(path);
    } catch {
      // Offline or already ended: this device signs out anyway.
    }
  }

  async function signOut({ notice }: { notice?: SessionNotice } = {}): Promise<void> {
    await revokeOnServer('/api/v1/auth/logout');
    endLocally(notice);
    tabSync.post({ type: 'signed-out' });
  }

  async function signOutEverywhere(): Promise<void> {
    await revokeOnServer('/api/v1/auth/logout-all');
    endLocally();
    tabSync.post({ type: 'signed-out' });
  }

  function endSession(notice: SessionNotice): Promise<void> {
    // Nothing to end here, so there is nothing to tell the other tabs (they may be signed in).
    if (store.get().status === 'signed-out') return Promise.resolve();
    endLocally(notice);
    tabSync.post({ type: 'signed-out' });
    return Promise.resolve();
  }

  async function switchClinic(tenantId: string): Promise<void> {
    const result = await client.POST('/api/v1/auth/switch-tenant', { body: { tenantId } });
    if (!result.data) throw networkError(new Error('Empty answer.'));
    const { activeTenantId, tenant, permissions } = result.data.data;
    const state = store.get();
    if (state.status === 'signed-in') {
      // Choosing a clinic ends the "you lost access" notice, so it is not carried over.
      store.set({
        status: 'signed-in',
        user: state.user,
        memberships: state.memberships,
        activeTenantId,
        permissions,
        platformRole: state.platformRole,
        // The old clinic's profile must never be offered in the new one.
        practitionerProfileId: null,
      });
    }
    emit({ type: 'clinic-changed', fromOtherTab: false, tenantName: tenant.name });
    tabSync.post({ type: 'clinic-switched', tenantId });
    await readPractitionerProfile(tenantId);
  }

  /**
   * The switch answer does not say whether the person is a practitioner in the new clinic, so
   * `GET /me` is read again (docs/clinical-integration.md, "GET /me"). The switch stands either way:
   * if this read fails, there is simply no "My schedule" until the next session reload.
   */
  async function readPractitionerProfile(tenantId: string): Promise<void> {
    try {
      const me = await client.GET('/api/v1/me');
      const state = store.get();
      if (!me.data || state.status !== 'signed-in' || state.activeTenantId !== tenantId) return;
      store.set({ ...state, practitionerProfileId: me.data.data.practitionerProfileId });
    } catch {
      // Offline or a server error: see above. A session that ended is handled by the client.
    }
  }

  async function refreshPermissions(): Promise<void> {
    try {
      await loadSession();
    } catch (error) {
      if (!(error instanceof ApiError)) return; // keep what we know; a 401 already ended the session
    }
  }

  return {
    boot,
    signIn,
    signOut,
    signOutEverywhere,
    endSession,
    switchClinic,
    refreshPermissions,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close: tabSync.close,
  };
}
