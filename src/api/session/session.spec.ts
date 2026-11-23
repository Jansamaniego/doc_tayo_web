import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readPreference } from '@/lib/preferences.ts';
import { server } from '@/test/msw/server.ts';

import { createApiClient } from '../client.ts';
import { networkError, parseErrorResponse } from '../errors.ts';
import { createSessionController, type SessionController, type SessionEvent } from './session.ts';
import { createSessionStore } from './session-store.ts';
import { createTokenStore } from './token-store.ts';

const API = 'https://api.test/api/v1';
let channel = 0;

const OWNER = { id: 'u1', email: 'owner@sunrise.test', fullName: 'Olivia Owner' };
const SUNRISE = {
  tenantId: 'a',
  tenantName: 'Sunrise Clinic',
  tenantStatus: 'active',
  membershipStatus: 'active',
  roles: [{ key: 'owner', name: 'Owner' }],
};
const HARBOR = {
  tenantId: 'b',
  tenantName: 'Harbor Clinic',
  tenantStatus: 'active',
  membershipStatus: 'active',
  roles: [{ key: 'receptionist', name: 'Receptionist' }],
};
const OWNER_PERMISSIONS = [
  'tenant.read',
  'tenant.settings.manage',
  'branches.read',
  'branches.manage',
  'members.invite',
];
const error = (status: number, code: string) =>
  HttpResponse.json(
    { error: { status, code, message: 'x', requestId: `req-${code}` } },
    { status },
  );

/** The API as a signed-in person with one clinic sees it. */
function happyApi(
  overrides: {
    activeTenantId?: string | null;
    memberships?: unknown[];
    permissions?: string[];
    platformRole?: 'none' | 'platform_admin';
  } = {},
) {
  const calls: string[] = [];
  server.use(
    http.post(`${API}/auth/refresh`, () => {
      calls.push('refresh');
      return HttpResponse.json({ data: { accessToken: 'tok-refreshed', expiresIn: 900 } });
    }),
    http.get(`${API}/me`, ({ request }) => {
      calls.push(`me:${request.headers.get('authorization') ?? 'none'}`);
      return HttpResponse.json({
        data: {
          ...OWNER,
          emailVerifiedAt: null,
          passwordChangedAt: null,
          platformRole: overrides.platformRole ?? 'none',
          activeTenantId: overrides.activeTenantId === undefined ? 'a' : overrides.activeTenantId,
          permissions: overrides.permissions ?? OWNER_PERMISSIONS,
        },
      });
    }),
    http.get(`${API}/me/memberships`, () =>
      HttpResponse.json({ data: overrides.memberships ?? [SUNRISE] }),
    ),
    http.post(`${API}/auth/login`, async ({ request }) => {
      calls.push(`login:${JSON.stringify(await request.json())}`);
      return HttpResponse.json({
        data: {
          accessToken: 'tok-login',
          expiresIn: 900,
          user: OWNER,
          memberships: overrides.memberships ?? [SUNRISE],
          activeTenantId: overrides.activeTenantId === undefined ? 'a' : overrides.activeTenantId,
        },
      });
    }),
    http.post(`${API}/auth/logout`, ({ request }) => {
      calls.push(`logout:${request.headers.get('authorization') ?? 'none'}`);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(`${API}/auth/logout-all`, () => {
      calls.push('logout-all');
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

function tab(name = `tab-${channel}`) {
  const tokens = createTokenStore();
  const store = createSessionStore();
  const events: SessionEvent[] = [];
  const refresh = vi.fn(async () => {
    const response = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    }).catch((cause: unknown) => {
      throw networkError(cause);
    });
    if (!response.ok) throw await parseErrorResponse(response);
    const token = ((await response.json()) as { data: { accessToken: string } }).data.accessToken;
    tokens.set(token);
    return token;
  });
  // eslint-disable-next-line prefer-const -- assigned after the client, which needs it
  let controller!: SessionController;
  const client = createApiClient({
    apiOrigin: 'https://api.test',
    getAccessToken: tokens.get,
    refresh,
    onSessionEnded: () => {
      void controller.endSession('expired');
    },
  });
  controller = createSessionController({ client, refresh, tokens, store, tabSyncName: name });
  controller.subscribe((event) => events.push(event));
  return { controller, tokens, store, events, refresh };
}

const open: SessionController[] = [];
beforeEach(() => {
  channel += 1;
  window.localStorage.clear();
});
afterEach(() => {
  for (const controller of open.splice(0)) controller.close();
});
const makeTab = (name?: string) => {
  const t = tab(name);
  open.push(t.controller);
  return t;
};

describe('boot (the first thing the app does)', () => {
  it('starts as booting, then restores a signed-in person from the refresh cookie', async () => {
    happyApi();
    const { controller, store, tokens } = makeTab();
    expect(store.get()).toEqual({ status: 'booting' });
    await controller.boot();
    expect(tokens.get()).toBe('tok-refreshed');
    expect(store.get()).toEqual({
      status: 'signed-in',
      user: OWNER,
      memberships: [SUNRISE],
      activeTenantId: 'a',
      permissions: OWNER_PERMISSIONS,
      platformRole: 'none',
    });
  });

  it('knows a platform admin, who may have no clinic at all', async () => {
    happyApi({
      platformRole: 'platform_admin',
      activeTenantId: null,
      memberships: [],
      permissions: [],
    });
    const { controller, store } = makeTab();
    await controller.boot();
    expect(store.get()).toMatchObject({
      status: 'signed-in',
      platformRole: 'platform_admin',
      activeTenantId: null,
      memberships: [],
    });
  });

  it('loads the profile with the NEW token (never an empty or stale one)', async () => {
    const calls = happyApi();
    await makeTab().controller.boot();
    expect(calls).toContain('me:Bearer tok-refreshed');
  });

  it('keeps activeTenantId null when the person has several clinics and has not chosen one', async () => {
    happyApi({ activeTenantId: null, memberships: [SUNRISE, HARBOR], permissions: [] });
    const { controller, store } = makeTab();
    await controller.boot();
    expect(store.get()).toMatchObject({
      status: 'signed-in',
      activeTenantId: null,
      permissions: [],
    });
  });

  it('is signed out when there is no valid cookie (401): no notice, just the sign-in page', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => error(401, 'UNAUTHENTICATED')));
    const { controller, store } = makeTab();
    await controller.boot();
    expect(store.get()).toEqual({ status: 'signed-out' });
  });

  it('says boot FAILED, not "signed out", when the API cannot be reached (the person may still be signed in)', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.error()));
    const { controller, store } = makeTab();
    await controller.boot();
    expect(store.get()).toMatchObject({ status: 'boot-failed', error: { code: 'NETWORK_ERROR' } });
  });

  it('says boot failed on a server error too', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => error(503, 'SERVICE_UNAVAILABLE')));
    const { controller, store } = makeTab();
    await controller.boot();
    expect(store.get()).toMatchObject({
      status: 'boot-failed',
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
  });

  it('can be tried again after a failed boot', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.error()));
    const { controller, store } = makeTab();
    await controller.boot();
    happyApi();
    await controller.boot();
    expect(store.get().status).toBe('signed-in');
  });
});

describe('signIn', () => {
  it('signs in, keeps the access token in memory and loads the permissions of the active clinic', async () => {
    const calls = happyApi();
    const { controller, store, tokens } = makeTab();
    await controller.boot().catch(() => undefined);
    store.set({ status: 'signed-out' });
    tokens.clear();
    await controller.signIn({
      email: 'owner@sunrise.test',
      password: 'dev-password-change-me-123',
      sharedComputer: false,
    });
    expect(tokens.get()).toBe('tok-login');
    expect(store.get()).toMatchObject({
      status: 'signed-in',
      user: OWNER,
      activeTenantId: 'a',
      permissions: OWNER_PERMISSIONS,
    });
    expect(calls).toContain('me:Bearer tok-login');
  });

  it('sends only the documented fields (the API rejects unknown ones)', async () => {
    const calls = happyApi();
    await makeTab().controller.signIn({
      email: 'a@b.test',
      password: 'secret-password',
      sharedComputer: true,
    });
    expect(calls).toContain('login:{"email":"a@b.test","password":"secret-password"}');
  });

  it('remembers "this is a shared computer" on this device (a harmless preference, never the password)', async () => {
    happyApi();
    await makeTab().controller.signIn({
      email: 'a@b.test',
      password: 'secret-password',
      sharedComputer: true,
    });
    expect(readPreference('sharedComputer')).toBe(true);
    await makeTab().controller.signIn({
      email: 'a@b.test',
      password: 'secret-password',
      sharedComputer: false,
    });
    expect(readPreference('sharedComputer')).toBe(false);
    expect(JSON.stringify(Object.entries(window.localStorage))).not.toContain('secret-password');
  });

  it('a wrong password throws the ApiError and changes nothing', async () => {
    server.use(http.post(`${API}/auth/login`, () => error(401, 'INVALID_CREDENTIALS')));
    const { controller, store, tokens } = makeTab();
    store.set({ status: 'signed-out' });
    await expect(
      controller.signIn({ email: 'a@b.test', password: 'nope', sharedComputer: false }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(store.get()).toEqual({ status: 'signed-out' });
    expect(tokens.get()).toBeNull();
  });

  it('a locked or throttled account throws RATE_LIMITED with Retry-After', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { error: { status: 429, code: 'RATE_LIMITED', message: 'x', requestId: 'r' } },
          { status: 429, headers: { 'retry-after': '120' } },
        ),
      ),
    );
    await expect(
      makeTab().controller.signIn({ email: 'a@b.test', password: 'x', sharedComputer: false }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 120 });
  });

  it('does not leave a half-signed-in session if loading the profile fails after the login worked', async () => {
    happyApi();
    server.use(http.get(`${API}/me`, () => error(500, 'INTERNAL_ERROR')));
    const { controller, store, tokens } = makeTab();
    store.set({ status: 'signed-out' });
    await expect(
      controller.signIn({ email: 'a@b.test', password: 'x', sharedComputer: false }),
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(tokens.get()).toBeNull();
    expect(store.get().status).toBe('signed-out');
  });
});

describe('signOut', () => {
  async function signedIn() {
    const calls = happyApi();
    const t = makeTab();
    await t.controller.boot();
    return { ...t, calls };
  }

  it('revokes the session on the server (with the token), then clears the token and the state', async () => {
    const { controller, tokens, store, calls } = await signedIn();
    await controller.signOut();
    expect(calls).toContain('logout:Bearer tok-refreshed');
    expect(tokens.get()).toBeNull();
    expect(store.get()).toEqual({ status: 'signed-out' });
  });

  it('carries the reason to the sign-in page, for example the inactivity sign-out', async () => {
    const { controller, store } = await signedIn();
    await controller.signOut({ notice: 'inactive' });
    expect(store.get()).toEqual({ status: 'signed-out', notice: 'inactive' });
  });

  it('still signs out on this device if the server cannot be reached', async () => {
    const { controller, tokens, store } = await signedIn();
    server.use(http.post(`${API}/auth/logout`, () => HttpResponse.error()));
    await controller.signOut();
    expect(tokens.get()).toBeNull();
    expect(store.get().status).toBe('signed-out');
  });

  it('signs out of every device with logout-all', async () => {
    const { controller, calls, store } = await signedIn();
    await controller.signOutEverywhere();
    expect(calls).toContain('logout-all');
    expect(store.get().status).toBe('signed-out');
  });

  it('tells the other tabs, which sign out on their own WITHOUT asking the server again', async () => {
    const name = `shared-${channel}`;
    const calls = happyApi();
    const first = makeTab(name);
    const second = makeTab(name);
    await first.controller.boot();
    await second.controller.boot();
    await first.controller.signOut();
    await vi.waitFor(() => {
      expect(second.store.get()).toEqual({ status: 'signed-out', notice: 'signed-out-elsewhere' });
    });
    expect(second.tokens.get()).toBeNull();
    expect(calls.filter((call) => call.startsWith('logout:'))).toHaveLength(1);
    expect(second.events).toContainEqual({ type: 'signed-out' });
  });

  it('is quiet about being signed out twice (both tabs may notice at once)', async () => {
    const { controller, events } = await signedIn();
    await controller.signOut();
    await controller.endSession('expired');
    expect(events.filter((event) => event.type === 'signed-out')).toHaveLength(1);
  });
});

describe('the server ends the session (expired or revoked elsewhere)', () => {
  it('endSession clears everything and says why', async () => {
    happyApi();
    const { controller, tokens, store } = makeTab();
    await controller.boot();
    await controller.endSession('expired');
    expect(tokens.get()).toBeNull();
    expect(store.get()).toEqual({ status: 'signed-out', notice: 'expired' });
  });

  it('a request that comes back UNAUTHENTICATED ends the session through the client', async () => {
    happyApi();
    const { controller, store, tokens } = makeTab();
    await controller.boot();
    server.use(http.get(`${API}/me`, () => error(401, 'UNAUTHENTICATED')));
    await controller.refreshPermissions();
    expect(store.get()).toEqual({ status: 'signed-out', notice: 'expired' });
    expect(tokens.get()).toBeNull();
  });
});

describe('switchClinic', () => {
  const switchApi = (calls: string[] = []): void => {
    server.use(
      http.post(`${API}/auth/switch-tenant`, async ({ request }) => {
        calls.push(`switch:${JSON.stringify(await request.json())}`);
        return HttpResponse.json({
          data: {
            activeTenantId: 'b',
            tenant: { id: 'b', name: 'Harbor Clinic', status: 'active' },
            permissions: ['tenant.read', 'branches.read'],
          },
        });
      }),
    );
  };

  it('is kept when the person switches clinic', async () => {
    happyApi({
      platformRole: 'platform_admin',
      activeTenantId: null,
      memberships: [SUNRISE, HARBOR],
      permissions: [],
    });
    switchApi();
    const { controller, store } = makeTab();
    await controller.boot();
    await controller.switchClinic('b');
    expect(store.get()).toMatchObject({ platformRole: 'platform_admin', activeTenantId: 'b' });
  });

  it("switches the active clinic and takes that clinic's permissions (the token does not change)", async () => {
    happyApi({ activeTenantId: null, memberships: [SUNRISE, HARBOR], permissions: [] });
    const calls: string[] = [];
    switchApi(calls);
    const { controller, store, tokens } = makeTab();
    await controller.boot();
    const before = tokens.get();
    await controller.switchClinic('b');
    expect(calls).toContain('switch:{"tenantId":"b"}');
    expect(store.get()).toMatchObject({
      activeTenantId: 'b',
      permissions: ['tenant.read', 'branches.read'],
    });
    expect(tokens.get()).toBe(before);
  });

  it('announces the change so the app can clear everything it cached for the old clinic', async () => {
    happyApi({ memberships: [SUNRISE, HARBOR] });
    switchApi();
    const { controller, events } = makeTab();
    await controller.boot();
    await controller.switchClinic('b');
    expect(events).toContainEqual({
      type: 'clinic-changed',
      fromOtherTab: false,
      tenantName: 'Harbor Clinic',
    });
  });

  it('a clinic that is suspended throws its error and changes nothing', async () => {
    happyApi({ memberships: [SUNRISE, HARBOR] });
    server.use(http.post(`${API}/auth/switch-tenant`, () => error(403, 'TENANT_SUSPENDED')));
    const { controller, store } = makeTab();
    await controller.boot();
    await expect(controller.switchClinic('b')).rejects.toMatchObject({ code: 'TENANT_SUSPENDED' });
    expect(store.get()).toMatchObject({ activeTenantId: 'a' });
  });

  it('another tab learns about it, reloads who it is and what it may do, and says it came from elsewhere', async () => {
    const name = `switch-${channel}`;
    happyApi({ memberships: [SUNRISE, HARBOR] });
    switchApi();
    const first = makeTab(name);
    const second = makeTab(name);
    await first.controller.boot();
    await second.controller.boot();
    // From now on /me answers for the new clinic, as the server session now does for every tab.
    server.use(
      http.get(`${API}/me`, () =>
        HttpResponse.json({
          data: {
            ...OWNER,
            emailVerifiedAt: null,
            passwordChangedAt: null,
            activeTenantId: 'b',
            permissions: ['tenant.read'],
          },
        }),
      ),
    );
    await first.controller.switchClinic('b');
    await vi.waitFor(() => {
      expect(second.events).toContainEqual({
        type: 'clinic-changed',
        fromOtherTab: true,
        tenantName: 'Harbor Clinic',
      });
    });
    expect(second.store.get()).toMatchObject({ activeTenantId: 'b', permissions: ['tenant.read'] });
  });
});

describe('a tab that is not signed in (a second window left on the sign-in page)', () => {
  // The API answers UNAUTHENTICATED to a request without a token, and the client reads that as "the
  // session ended". Such a tab must neither ask who it is nor tell the other tabs it signed out.
  const apiWithoutToken = (calls: string[]): void => {
    server.use(
      http.get(`${API}/me`, ({ request }) => {
        calls.push(`me:${request.headers.get('authorization') ?? 'none'}`);
        return request.headers.get('authorization')
          ? HttpResponse.json({
              data: {
                ...OWNER,
                emailVerifiedAt: null,
                passwordChangedAt: null,
                platformRole: 'none',
                activeTenantId: 'b',
                permissions: ['tenant.read'],
              },
            })
          : error(401, 'UNAUTHENTICATED');
      }),
      http.post(`${API}/auth/switch-tenant`, () =>
        HttpResponse.json({
          data: {
            activeTenantId: 'b',
            tenant: { id: 'b', name: 'Harbor Clinic', status: 'active' },
            permissions: ['tenant.read'],
          },
        }),
      ),
    );
  };
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 150));

  it('does not sign anyone out when another tab picks a clinic', async () => {
    const name = `idle-${channel}`;
    const calls: string[] = [];
    happyApi({ activeTenantId: null, memberships: [SUNRISE, HARBOR] });
    const signedInTab = makeTab(name);
    const signedOutTab = makeTab(name);
    await signedInTab.controller.boot();
    signedOutTab.store.set({ status: 'signed-out' });
    apiWithoutToken(calls);

    await signedInTab.controller.switchClinic('b');
    await settle();

    expect(signedInTab.store.get()).toMatchObject({ status: 'signed-in', activeTenantId: 'b' });
    expect(signedInTab.tokens.get()).not.toBeNull();
    expect(signedOutTab.store.get()).toEqual({ status: 'signed-out' });
    expect(calls).toEqual([]);
  });

  it('being told its session ended changes nothing and tells nobody', async () => {
    const name = `quiet-${channel}`;
    happyApi();
    const signedInTab = makeTab(name);
    const signedOutTab = makeTab(name);
    await signedInTab.controller.boot();
    signedOutTab.store.set({ status: 'signed-out' });

    await signedOutTab.controller.endSession('expired');
    await settle();

    expect(signedOutTab.store.get()).toEqual({ status: 'signed-out' });
    expect(signedInTab.store.get().status).toBe('signed-in');
  });
});

describe('platformRole after the role is taken away', () => {
  it('is read again by refreshPermissions, so the admin tabs can disappear', async () => {
    happyApi({ platformRole: 'platform_admin' });
    const { controller, store } = makeTab();
    await controller.boot();
    expect(store.get()).toMatchObject({ platformRole: 'platform_admin' });
    happyApi({ platformRole: 'none' });
    await controller.refreshPermissions();
    expect(store.get()).toMatchObject({ platformRole: 'none' });
  });
});

describe('refreshPermissions (after a 403: the permissions may have changed mid-session)', () => {
  it('reloads who the person is and what they may do', async () => {
    happyApi();
    const { controller, store } = makeTab();
    await controller.boot();
    server.use(
      http.get(`${API}/me`, () =>
        HttpResponse.json({
          data: {
            ...OWNER,
            emailVerifiedAt: null,
            passwordChangedAt: null,
            activeTenantId: 'a',
            permissions: ['tenant.read'],
          },
        }),
      ),
    );
    await controller.refreshPermissions();
    expect(store.get()).toMatchObject({ permissions: ['tenant.read'] });
  });

  it('keeps the old permissions when the reload fails for a reason that is not "signed out" (offline)', async () => {
    happyApi();
    const { controller, store } = makeTab();
    await controller.boot();
    server.use(http.get(`${API}/me`, () => HttpResponse.error()));
    await controller.refreshPermissions();
    expect(store.get()).toMatchObject({ status: 'signed-in', permissions: OWNER_PERMISSIONS });
  });
});

describe('losing the active clinic (suspended or removed by an admin, plan 05 §5.5)', () => {
  const clinicLostApi = () => {
    server.use(
      http.get(`${API}/me`, () =>
        HttpResponse.json({
          data: {
            ...OWNER,
            emailVerifiedAt: null,
            passwordChangedAt: null,
            platformRole: 'none',
            activeTenantId: null,
            permissions: [],
          },
        }),
      ),
    );
  };

  it('keeps the person signed in, with no active clinic, and remembers the name of the clinic they lost', async () => {
    happyApi({ memberships: [SUNRISE, HARBOR] });
    const { controller, store, tokens } = makeTab();
    await controller.boot();
    clinicLostApi();
    await controller.refreshPermissions();
    expect(store.get()).toMatchObject({
      status: 'signed-in',
      activeTenantId: null,
      permissions: [],
      lostClinicName: 'Sunrise Clinic',
    });
    expect(tokens.get()).toBe('tok-refreshed');
  });

  it('announces it, so the app clears everything it cached for that clinic', async () => {
    happyApi();
    const { controller, events } = makeTab();
    await controller.boot();
    clinicLostApi();
    await controller.refreshPermissions();
    expect(events).toContainEqual({ type: 'clinic-lost' });
  });

  it('keeps the name when the session is read again before a clinic is chosen, and says nothing twice', async () => {
    happyApi();
    const { controller, store, events } = makeTab();
    await controller.boot();
    clinicLostApi();
    await controller.refreshPermissions();
    await controller.refreshPermissions();
    expect(store.get()).toMatchObject({ lostClinicName: 'Sunrise Clinic' });
    expect(events.filter((event) => event.type === 'clinic-lost')).toHaveLength(1);
  });

  it('forgets the name once a clinic is chosen', async () => {
    happyApi({ memberships: [SUNRISE, HARBOR] });
    server.use(
      http.post(`${API}/auth/switch-tenant`, () =>
        HttpResponse.json({
          data: {
            activeTenantId: 'b',
            tenant: { id: 'b', name: 'Harbor Clinic', status: 'active' },
            permissions: ['tenant.read'],
          },
        }),
      ),
    );
    const { controller, store } = makeTab();
    await controller.boot();
    clinicLostApi();
    await controller.refreshPermissions();
    await controller.switchClinic('b');
    expect(store.get()).toMatchObject({ activeTenantId: 'b' });
    expect(store.get()).not.toHaveProperty('lostClinicName');
  });

  it('does not report a loss for a person who never had an active clinic, or who still has it', async () => {
    happyApi({ activeTenantId: null, memberships: [SUNRISE, HARBOR], permissions: [] });
    const first = makeTab();
    await first.controller.boot();
    await first.controller.refreshPermissions();
    expect(first.store.get()).not.toHaveProperty('lostClinicName');
    expect(first.events).toEqual([]);

    happyApi();
    const second = makeTab();
    await second.controller.boot();
    await second.controller.refreshPermissions();
    expect(second.store.get()).not.toHaveProperty('lostClinicName');
    expect(second.events).toEqual([]);
  });
});
