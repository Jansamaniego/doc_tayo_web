# Phase 3: App shell and authentication (outline)

Status: **in progress** (started 2026-11-21; see "As Built" at the end). Depends on Phases 1–2 (design system approved). Backend: **available now**.

## Objectives

Full session lifecycle, the clinic picker and switcher, the permission-aware app shell for every role, all email-link pages, global error and rate-limit handling, and the shared-computer inactivity sign-out. All text comes from the English catalogue; Filipino is Phase 14.

## Deliverables

- **Boot:** `POST /auth/refresh` on start → `GET /me` + `GET /me/memberships` → route to the app, the clinic picker or sign-in. A full-page "Loading DocTayo…" while booting (no flash of the sign-in page).
- **Session module** (`src/api/session/`):
  - in-memory token store;
  - single-flight refresh **plus Web Locks across tabs**;
  - one retry after `ACCESS_TOKEN_EXPIRED`;
  - `BroadcastChannel` events `signed-out` and `clinic-switched`;
  - query cache cleared on sign-out and on clinic switch;
  - query keys prefixed with the clinic id.
- **Pages:**
  - `/login`: email + password; `INVALID_CREDENTIALS` and `RATE_LIMITED` with a `Retry-After` countdown; "Forgot your password?".
  - `/forgot-password`: always the same confirmation, never says whether the account exists.
  - `/reset-password#token=…`: reads the fragment, removes it with `history.replaceState`, posts token + password. On `TOKEN_INVALID`, offers "Send a new link". On success, says "all your devices were signed out" and goes to sign-in.
  - `/account-setup#token=…`: same pattern plus optional full name.
  - `/accept-invitation#token=…`: sends `{ token }` first. On `VALIDATION_FAILED` with `fullName`/`newPassword` `REQUIRED`, reveals those fields and sends again. Then goes to sign-in (there is no automatic sign-in).
  - `/select-clinic`: active memberships selectable; suspended or deactivated ones shown as unavailable with the reason in words.
- **App shell:**
  - top bar with clinic switcher (calls `switch-tenant`), branch selector (client-side preference until D-9), user menu (My account, Sign out, Sign out on all devices);
  - side or bottom navigation built from permission keys (navigation config: item → required permission → route);
  - placeholder "Home" per area;
  - "Coming soon" items **not** shown (no menu entries for unavailable features).
- **Global handling:** the error map in plan.md §5.7, offline banner, route error boundary, `requestId` support details, 403 → refresh permissions.
- **Landing per role:** chosen from permissions (integration guide §5). Role `name`s (now `{ key, name }`) label people in the clinic picker and user menu. Doctor- or reception-specific homes also need D-9.
- **Shared-computer sign-out** (plan.md §5.3.1; decided Q16):
  - the "This is a shared computer" option on sign-in; personal devices are never timed out by the client;
  - 10 minutes without input, counted across tabs (`BroadcastChannel`), so an active tab keeps the others alive;
  - a warning 60 seconds before, with a large "Stay signed in";
  - at timeout: `POST /api/v1/auth/logout` (server-side revoke), then clear the token from memory, the cache and the screen;
  - unsaved form input is kept **in memory** and restored only for the same user signing in again on that tab; it is discarded if another user signs in;
  - a shorter **server-side** idle lifetime for shared-computer sessions is backend request D-26.

## Backend endpoints

| Endpoint                                                                                                        | Exists                                                   |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/switch-tenant`                  | yes                                                      |
| `POST /auth/password/forgot`, `/auth/password/reset`, `/auth/account/setup`, `/invitations/accept`              | yes                                                      |
| `GET /me`, `GET /me/memberships`                                                                                | yes                                                      |
| Expected-tenant header (D-1), branch assignment/practitioner (D-9), shared-computer server idle lifetime (D-26) | **no**: dependencies (role keys, D-5, are now available) |

## Tests (to be detailed before implementation)

- Unit: refresh single-flight; Web Locks wrapper (mocked lock manager); the error → action map; the permission helper; fragment token reader (removes the token from the URL).
- Component: each page's states (idle, submitting, field errors, rate limited with countdown, token invalid, success); navigation hides items without permission; axe.
- E2E (real API, seeded accounts):
  - owner signs in, sees settings items;
  - receptionist does not, and a direct URL shows "no access";
  - reload keeps the session;
  - an expired token refreshes transparently (short-lived token config, or waiting with a test clock: _how is to be decided with the backend_);
  - **two tabs refreshing at once do not sign out**;
  - sign-out in one tab signs out the other;
  - a clinic switch in tab A shows the notice in tab B;
  - wrong password 5× → rate-limit message;
  - reset password via the link from the API log or file transport (needs a way to read emails in e2e: `MAIL_TRANSPORT=file` and read `var/mail`; _to confirm with the backend_);
  - invitation acceptance for new and existing users;
  - shared-computer mode (timeout shortened in tests):
    - the warning appears, and "Stay signed in" keeps the session;
    - with no response, `POST /auth/logout` is called and **a later refresh with the old cookie answers `401`** (the server really revoked it);
    - the token and screen are cleared;
    - after the same user signs in, the same page and the unsaved input return;
    - **a different user signing in sees none of it**;
    - a personal device (option off) is never timed out;
  - keyboard-only sign-in; axe on every page.
- Cross-tenant: after switching clinic, no data from the previous clinic is visible (seed a second clinic: **the dev seed has only one; backend seed change needed**).

## Acceptance criteria (draft)

All flows in the integration guide §4–§7 work against the local API. No token in Web Storage (asserted in e2e by inspecting storage). Two-tab refresh test passes. axe clean.

## Open questions

- A second seeded clinic and a multi-clinic user for e2e (backend seed).
- Reading emails in e2e (file transport path).
- Q16a: may unsaved input use `sessionStorage` (survives a reload) instead of memory only? Default: memory only.

## As Built (in progress, 2026-11-21)

Done and verified by Vitest (70 files, 937 specs in New York time; the Manila pass of `src/lib` and `src/test` also passes), tsc, eslint and Prettier:

- Session module in `src/api/session/` (single-flight refresh plus Web Lock, one retry on `ACCESS_TOKEN_EXPIRED`, tab messages) and the API client retry.
- Screens in `src/features/auth/`: sign-in, forgot password, reset password, account setup, accept invitation, clinic picker.
- Routes in `src/routes/`: `/login` (search: `notice`), `/forgot-password`, `/reset-password`, `/account-setup`, `/accept-invitation` (token read once from the fragment in `beforeLoad`, forgotten on leaving), `/select-clinic`, and the `_app` layout (guard: signed in and a clinic chosen; renders the app shell) with `/` inside it. Guards are in `src/app/guards.ts`; they read the in-memory session store.
- `App.tsx` boots the session first (loading screen, or an error with Try again when the API is unreachable), then renders the router, re-runs the guards when the session changes and clears the query cache on sign-out or clinic change.
- App shell with the clinic switcher, user menu (sign out; sign out on all devices asks first) and navigation. Only **Home** exists, so only Home is listed. `UserMenu.onAccount` is optional (the item is hidden without it); the shell passes it, so **My account** opens `/account`.
- Account page (`/account`, inside the shell, `src/features/account/`): read-only details from the session (name, email, active clinic, roles; there is no `PATCH /me`) and the change-password form (`POST /me/password`, 204; the other sessions are revoked and this one stays signed in; field errors `PASSWORD_INCORRECT` on `currentPassword` and the new-password codes on `newPassword`; `RATE_LIMITED` shows the wait). It does not call `GET /me`: the session already holds the same fields. Last password change date is not shown (it needs a time zone decision).
- Home page: static (welcome, "Today at a glance" with empty figures, getting-started steps). The figures arrive with appointments.

Deviations from the draft above:

- `RootLayout` no longer renders `<main>`; each layout (app shell, sign-in card, not-found, error page) renders its own `<main id="main">`.
- The sign-in page also shows three notices after the email-link flows (`password-reset`, `account-ready`, `invitation-accepted`) through a `notice` search parameter.

Changed by Phase 4 (see plans/04-platform-admin.md): the `_app` layout needs only a signed-in session; `_clinic` (home) needs a chosen clinic; `/account` needs none. The session holds `platformRole`. `createQueryClient` refreshes `GET /me` on any `FORBIDDEN` (the "403 → refresh permissions" item). The shared e2e `page` fixture stubs `/auth/refresh` unless `realSession` is set.

**Changed 2026-11-23 (sign-in always leads to the home page):** the sign-in page used to remember the page the person was on (`/login?redirect=…`, checked by `safe-redirect.ts`) and return them to it. A stale address sent a clinic admin to `/admin` ("page not found") and a doctor to `/account`, so the behavior was removed: `requireSignedIn` sends a signed-out person to plain `/login`, signing in navigates to `/`, and an old `?redirect=` in a link is ignored. `/` then sends the person where they belong (the clinic home, the clinic picker, or `/admin` for a platform admin with no clinic). `safe-redirect.ts` and its spec were deleted; the guards take no arguments.

**Fixed 2026-11-23 ("You signed out in another window" right after choosing a clinic):** a second tab of the app that was not signed in (for example left on the sign-in page) heard "clinic switched", asked `GET /me` without a token, got `UNAUTHENTICATED`, and so ended its own "session" and broadcast a sign-out, which the tab that had just signed in obeyed. A tab that is not signed in now ignores `clinic-switched`, and `endSession` on a signed-out tab does nothing and tells no one (`session.spec.ts`, "a tab that is not signed in").

Not done yet: branch selector (`GET /branches`), inactivity sign-out with warning and in-memory drafts, global error handling and offline banner, the e2e infrastructure (mail catcher, seeded second clinic) and the Phase 3 e2e specs. `tests/e2e/smoke.spec.ts` was updated for the sign-in page but **not run** (Docker e2e not run this session).

**Known failure:** `npm run size` reports startup JavaScript at 179.3 kB of the 170 kB budget (it was 164.7 kB). The session boot code is now in the startup path. Either trim it or raise the budget in plan.md §11: not decided.
