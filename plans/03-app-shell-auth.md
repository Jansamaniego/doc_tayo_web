# Phase 3: App shell and authentication (outline)

Status: **outline** (revised 2026-11-20). Depends on Phases 1–2 (design system approved). Backend: **available now**.

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
