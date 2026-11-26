# Frontend integration guide

For the people (or AI agent) building the DocTayo web app against this API. It tells you what exists today, how to run it, and the rules the client must follow. **The exact request and response shapes are in [openapi.json](openapi.json)**; this guide covers everything that file cannot express.

Read next, as needed: [authentication.md](authentication.md) (why it works this way), [error-codes.md](error-codes.md), [api-conventions.md](api-conventions.md), [authorization.md](authorization.md).

## 1. What exists today (and what does not)

| Area | State |
|---|---|
| Sign-in, refresh, logout, logout everywhere, switch clinic | **Available** |
| Forgot/reset password, change password, account setup, accepting an invitation | **Available** |
| `GET /me`, `PATCH /me` (name), `/me/memberships`, `/me/sessions`, `DELETE /me/sessions/:id` | **Available** |
| Email change: `POST /me/email`, then `POST /auth/email/verify` from the emailed link | **Available** |
| Clinic profile (`GET/PATCH /tenant`) and branches (list, create, view, edit) | **Available** |
| Staff: list, view, change roles and job title, suspend, reactivate, remove (`/members`) | **Available** (`members.read` / `members.manage`; [staff-management-integration.md](staff-management-integration.md)) |
| Invitations: list, invite, resend, revoke (`/invitations`) | **Available** (`members.read` to list; `members.invite` for the rest; [staff-management-integration.md](staff-management-integration.md)) |
| Roles and permissions for the staff screens (`GET /roles`, `GET /permissions`) | **Available** (`members.read`) |
| Platform admin tabs: Clinics and Users (`/admin/*`) | **Available** to platform admins only ([platform-admin-integration.md](platform-admin-integration.md)) |
| A phone number on the profile | **Not available** (`TODO-LATER L-01` in `later.md`) |
| Patients: list, search, possible duplicates, register, view, edit, archive, restore (`/patients`) | **Available** (`patients.read` / `patients.manage`, held by all five default roles; [clinical-integration.md](clinical-integration.md)) |
| Staff directory (`/directory`), practitioner profiles, weekly schedules and availability (`/practitioners`), `GET /me` → `practitionerProfileId` | **Available** (`directory.read`; `practitioners.manage` to edit; [clinical-integration.md](clinical-integration.md)) |
| Services catalog (`/services`): list, view, add, edit, deactivate | **Available** (`services.read`; `services.manage` to edit; [clinical-integration.md](clinical-integration.md#52-services-catalog)) |
| Appointments, consultations, prescriptions | **Not available yet** (Phase 5 sub-phases 5.3 to 5.5; each is announced here when its endpoints and its part of the clinical guide are ready) |
| Billing, notifications, reports | **Not available** (Phase 6) |
| Contract fixes from the frontend's requests D-30 and D-1 | **Available** (Phase 5.0): every path parameter is declared in `openapi.json` (the `pathParams()` workaround can go after you re-sync the contract), and the optional `X-Expected-Tenant-Id` header makes the API refuse a request made for the wrong clinic (`409 TENANT_MISMATCH`, see [api-conventions.md](api-conventions.md)) |
| `Idempotency-Key` header (safe retries of creating requests) | **Ready on the server**, first used by patient registration (sub-phase 5.1); see [api-conventions.md](api-conventions.md) |
| Clinical permissions in `GET /me` and `GET /roles` | **Available**: twenty keys now; doctors and nurses get the clinical ones, owners, clinic admins and receptionists do not get medical-record keys ([authorization.md](authorization.md)) |

Do not build screens or client code for the "not available" rows; the endpoints do not exist yet.

## 2. Run it locally

```bash
docker compose up --build -d            # API on :3000 and Postgres (see docker.md)
docker compose run --rm --build migrate # apply migrations (--build after pulling new migrations)
npm run db:seed:dev                     # creates the development clinic and users (see below)
```

Without Docker, follow the README quick start, then `npm run db:seed:dev`. The seed uses the `DATABASE_URL` in `.env`; for the Docker database that is port `5434`. It refuses to run in production and is safe to run repeatedly; a second run also puts the seeded staff back to active with their original role.

**Seeded accounts** (the same password for all: `dev-password-change-me-123`):

| Account | Role | Notes |
|---|---|---|
| `owner@sunrise.test` | Owner | every permission; one clinic, "Sunrise Clinic" (branches "Main" and "Quezon City Annex") |
| `clinic-admin@sunrise.test` | Clinic admin | every permission, but not an owner: cannot give or take the Owner role or change an owner's status (see `OWNER_REQUIRED`) |
| `doctor@sunrise.test` | Doctor | clinical permissions (patients, appointments, medical records); no staff screens, no clinic settings |
| `reception@sunrise.test` | Receptionist | front desk: patients and appointments, **no medical records**; no staff screens; useful for testing hidden/disabled UI and `403` |
| `owner@lakeside.test` | Owner | every permission; one clinic, "Lakeside Family Clinic" (branch "Main") |
| `multi@doctayo.test` | Clinic admin in Sunrise Clinic, Doctor in Lakeside Family Clinic | **two clinics**: sign-in selects none, so the clinic picker shows; after switching, the permissions follow the clinic (administration in Sunrise, clinical in Lakeside) |
| `admin@doctayo.test` | Platform admin | no clinic; reaches only `/admin/*` ([platform-admin-integration.md](platform-admin-integration.md)) |

Useful URLs: API `http://localhost:3000/api/v1`, Swagger UI `http://localhost:3000/api/docs`, live OpenAPI `http://localhost:3000/api/docs-json` (non-production), health `http://localhost:3000/api/health`.

**API environment the frontend developer must have** (`.env`, see [environment.md](environment.md)): `CORS_ALLOWED_ORIGINS=http://localhost:5173` (your dev origin) and `CORS_ALLOW_CREDENTIALS=true` (without it the refresh cookie is never sent). `localhost` on different ports counts as the **same site**, so the cookie works locally. In production the app and API must share a registrable domain (for example `app.` and `api.`).

**Emails in development** (invitation, reset, setup and email-change links): with the default `MAIL_TRANSPORT=log` the API prints each email; the **link is in the body, printed at `debug` log level** (`LOG_LEVEL=debug`, the `.env.example` default). Copy the link from the API console.

**Typed client:** generate types from the contract, for example `npx openapi-typescript docs/openapi.json -o src/api/schema.d.ts` (a suggestion; not run as part of this repository). Regenerate whenever `docs/openapi.json` changes. The contract declares the `bearer` security scheme (every operation needs it except the public ones, which have `security: []`) and the error body: every 4xx/5xx response references the `ErrorResponse` schema, whose `ErrorCode` and `FieldErrorCode` enums list every code (see [error-codes.md](error-codes.md)).

## 3. Conventions

- Base path `/api/v1`. JSON, `camelCase`, UUID ids, ISO-8601 UTC timestamps (convert to the clinic's time zone in the UI; `GET /tenant` returns it).
- Success: `{ "data": ... }`, lists also `"meta": { page, pageSize, totalItems, totalPages }`. `204` has no body.
- Errors, always this shape:
  ```json
  { "error": { "status": 400, "code": "VALIDATION_FAILED", "message": "Some fields need attention.",
      "details": [ { "field": "newPassword", "code": "PASSWORD_TOO_COMMON", "message": "..." } ],
      "requestId": "0198..." } }
  ```
  **Branch on `code`, never on `message`.** `details` only appears for validation errors; `field` is a dotted path. Show `requestId` (also the `X-Request-Id` header) when a user reports a problem.
- Unknown request fields are rejected (`UNKNOWN_FIELD`): send only the documented fields.

## 4. Authentication, step by step

**Storage rule:** keep the **access token in memory** (a variable or store), never in `localStorage`. The refresh token is an httpOnly cookie you cannot and should not touch.

1. **Sign in:** `POST /auth/login` with `{ email, password }` and `credentials: 'include'`. Response `data`: `accessToken`, `expiresIn` (seconds, 900), `user`, `memberships`, `activeTenantId`. The browser stores the refresh cookie `dt_refresh` automatically.
2. **Call the API:** `Authorization: Bearer <accessToken>`.
3. **Token expired:** a request answers `401` with `error.code === "ACCESS_TOKEN_EXPIRED"`. Call `POST /auth/refresh` (no body, `credentials: 'include'`), store the new `accessToken`, **retry the original request once**. Any other `401` (`UNAUTHENTICATED`) means the session is over: go to the sign-in screen.
4. **Page reload:** the in-memory token is gone. On app start call `POST /auth/refresh`; if it returns `200` the user is still signed in, if `401` show the sign-in screen.
5. **Sign out:** `POST /auth/logout` (this device) or `/auth/logout-all` (every device), both with `Authorization` and `credentials: 'include'`, then clear your in-memory token and state.

**Serialise refresh calls.** Two refreshes in flight with the same cookie count as stolen-token reuse and the server **ends the session** (the user is signed out everywhere on that session). Use one shared "refresh in progress" promise so concurrent `401`s wait for the same refresh:

```ts
let refreshing: Promise<string> | null = null;
export function refreshAccessToken(): Promise<string> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) throw new Error('signed-out');
      return (await res.json()).data.accessToken as string;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}
```

`refresh`, `logout` and `logout-all` also need an `Origin` header that the API allows. Browsers add it to cross-origin `POST` requests; just make sure your origin is in `CORS_ALLOWED_ORIGINS`. Otherwise the API answers `403 FORBIDDEN`.

## 5. Choosing and switching clinics

- A user can belong to several clinics. `login` returns `memberships` (each with `tenantId`, `tenantName`, `tenantStatus`, `membershipStatus`, `roles`: a list of `{ key, name }`, where `key` is the stable machine key such as `owner` and `name` is the display text). Decide what a user may DO from `permissions` (`GET /me`, `switch-tenant`), not from role keys; use roles to label people and `activeTenantId`.
- `activeTenantId` is set automatically only when the user has **exactly one** active membership in an active clinic. Otherwise it is `null`: show a clinic picker (offer the memberships whose `membershipStatus` and `tenantStatus` are both `active`; show suspended ones as unavailable) and call `POST /auth/switch-tenant` with `{ tenantId }`.
- Any clinic-scoped call (`/tenant`, `/branches`, `/members`, `/invitations`, `/roles`) made with no active clinic answers `403 TENANT_NOT_SELECTED`: send the user to the picker. This also happens right after an admin suspends or removes the user in that clinic: the API unselects the clinic on their sessions.
- `switch-tenant` takes effect on the very next request; **the access token does not change**. Its response gives the new `tenant` and the `permissions` held there.
- **Menus and buttons:** use `GET /me` → `permissions` (the user's permissions in the active clinic) to show or hide UI, and `GET /me` → `platformRole` (`platform_admin` or `none`) for the platform-admin tabs. This is for convenience only; the server enforces permissions on every request.

Current permission keys: `tenant.read`, `tenant.settings.manage`, `branches.read`, `branches.manage`, `members.read`, `members.invite`, `members.manage` (owner and clinic admin hold all of them; doctor, nurse and receptionist hold `tenant.read` and `branches.read`). `GET /permissions` returns the list with descriptions.

## 6. What to do for each error

| `error.code` | HTTP | Do this |
|---|---|---|
| `ACCESS_TOKEN_EXPIRED` | 401 | Refresh once, retry the request. |
| `UNAUTHENTICATED` | 401 | Session over (or never signed in): show sign-in. |
| `INVALID_CREDENTIALS` | 401 | Sign-in only. Show "The email or password is incorrect." (the API never says which). |
| `RATE_LIMITED` | 429 | Too many attempts or account locked. Read the `Retry-After` header (seconds) and show a wait message. A locked account answers the same way, even with the right password. |
| `VALIDATION_FAILED` | 400 | Put each `details[]` item under its `field`. |
| `TOKEN_INVALID` | 400 | The emailed link is used, expired or replaced: offer "send a new link". |
| `FORBIDDEN` | 403 | The user lacks the permission; hide or disable the action. |
| `TENANT_NOT_SELECTED` | 403 | Show the clinic picker. |
| `TENANT_ACCESS_DENIED` | 403 | The user is not an active member of that clinic. |
| `TENANT_SUSPENDED`, `TENANT_DEACTIVATED` | 403 | The clinic is unavailable; show the message, offer another clinic. |
| `NOT_FOUND` | 404 | Also returned for another clinic's records. |
| `CONFLICT`, `CONFLICT_UNIQUE` | 409 | Already exists / invalid state (for invitations: "already a member", "an invitation is already open: resend it"). |
| `ROLE_NOT_ASSIGNABLE` | 422 | The Owner role cannot be given by invitation. |
| `OWNER_REQUIRED` | 403 | Only an owner may give or take the Owner role, or suspend/remove/reactivate an owner. Use `GET /roles` → `assignable` to offer only allowed roles. |
| `SELF_ACTION_FORBIDDEN` | 403 | Nobody can suspend, remove or change the roles of their own membership (another admin must), nor change their own account status in `/admin`. Hide those actions on the user's own row. |
| `LAST_OWNER` | 409 | The change would leave the clinic with no active owner (in practice only when two owners act at the same moment). Reload and show the message. |
| `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR` | 503/500 | Generic "try again" with the `requestId`. |

Full list: [error-codes.md](error-codes.md). Field-level codes include `REQUIRED`, `INVALID_FORMAT`, `TOO_SHORT`, `TOO_LONG`, `UNKNOWN_FIELD`, `PASSWORD_TOO_COMMON`, `PASSWORD_CONTAINS_EMAIL`, `PASSWORD_INCORRECT`.

## 7. Pages the emails link to

The API emails links to **your** app (the base URL is the API's `APP_PUBLIC_URL`). The token is in the URL **fragment** (`#token=...`), so it is never sent to a server or logged. Read it in the browser, then remove it from the address bar (`history.replaceState`) and send it in the request body.

| Route you must build | Reached from | Reads | Calls |
|---|---|---|---|
| `/forgot-password` | "Reset my password" in the password-changed email; your own sign-in screen | email field | `POST /auth/password/forgot` `{ email }` → always `202` (never say whether the account exists) |
| `/reset-password#token=…` | password-reset email (valid 30 minutes, single use) | token + new password | `POST /auth/password/reset` `{ token, newPassword }` → `204`; **all sessions end**, send the user to sign-in |
| `/account-setup#token=…` | setup email to a new clinic owner (valid 7 days, single use) | token + new password (+ optional `fullName`) | `POST /auth/account/setup` → `204`, then sign-in |
| `/accept-invitation#token=…` | invitation email (valid 7 days) | token (+ name and password for new users) | `POST /invitations/accept` → `204`, then sign-in (there is **no automatic sign-in**) |
| `/verify-email#token=…` | email-change email, sent to the **new** address (valid 30 minutes, single use) | token | `POST /auth/email/verify` `{ token }` → `204`; **all sessions end**, sign in with the new address. `409 CONFLICT_UNIQUE`: the address got taken meanwhile |
| `/login` | ownership notice email | | |

**Accepting an invitation:** the page cannot know whether the invited email already has an account. Send `{ token }` first. If the API answers `400 VALIDATION_FAILED` with `details` for `fullName` and `newPassword` (`REQUIRED`), reveal those two fields and send again with `{ token, fullName, newPassword }`. An existing active user needs only the token.

**Password rules** (show as hints; the server decides): 10–128 characters, not a very common password, must not contain the email address. No uppercase/digit/symbol rule. Server errors arrive as `details` with `TOO_SHORT`, `TOO_LONG`, `PASSWORD_TOO_COMMON` or `PASSWORD_CONTAINS_EMAIL` on `newPassword`; a wrong current password on change is `PASSWORD_INCORRECT` on `currentPassword`.

## 8. Account screens

- **Profile:** `GET /me`; `PATCH /me` `{ fullName }` → `200` with the `GET /me` shape. Only the name can be edited (no phone yet).
- **Change email:** `POST /me/email` `{ newEmail, currentPassword }` → always `202 { data: { accepted: true } }` when the password is right (`400 PASSWORD_INCORRECT` on `currentPassword` otherwise), whether or not the address is free: say "check the new inbox". The email does not change until the link is opened (`/verify-email`, section 7); the old address then gets a notice. Limited to 5 attempts per 15 minutes per user (`429`).
- **Change password:** `POST /me/password` `{ currentPassword, newPassword }` → `204`. The current device stays signed in; every other session is revoked. Limited to 5 attempts per 15 minutes per user (`429`).
- **Devices:** `GET /me/sessions` (flags `current`); `DELETE /me/sessions/:id` revokes one (`204`). Revoking the current one signs out.

## 9. Staff and platform screens

- **Staff, invitations, profile and email change (Phase 4):** the screens, which buttons to show for whom, and the errors of each are in [staff-management-integration.md](staff-management-integration.md), split into sub-phases (owner and clinic-admin screens first).
- **Platform admin:** the Clinics and Users tabs, shown when `GET /me` → `platformRole` is `platform_admin`. Everything about them is in [platform-admin-integration.md](platform-admin-integration.md).

## 10. Things that will bite you

- Forgetting `credentials: 'include'` on `login`, `refresh` and `logout`: the cookie is silently not stored or sent.
- Refreshing concurrently (section 4): it logs the user out.
- Storing the access token in `localStorage`: avoid; keep it in memory and rely on the refresh on reload.
- Reading `message` to decide behaviour: use `code`.
- Trying the same email many times on the sign-in form: `429` after 5 attempts per 15 minutes per address, and 30 per 15 minutes per IP.
- Every `/auth/*` and `/me*` response is `Cache-Control: no-store`; do not override that in a service worker or proxy cache.
