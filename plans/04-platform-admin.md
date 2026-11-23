# Phase 4: Platform admin tabs (Clinics and Users)

Status: **built** (2026-11-23; see "As Built"); **M6, the platform overview at `/admin`, added and built 2026-11-23** (see "As Built"). Backend: **available** (backend Phase 4, commit `c14e285`; [docs/platform-admin-integration.md](../docs/platform-admin-integration.md)). Depends on Phase 3: the session, route guards and app shell it builds are changed here (see "Start condition").

## 1. Objectives

DocTayo operators ("platform admins") can onboard and manage clinics from the web app, with no access to any clinic's data:

- see **every clinic at a glance** on a platform overview (the landing page): counts by status, what needs attention, the clinics themselves, and system status;
- list, search and filter clinics; open one; create a clinic with its first owner; suspend, reactivate or deactivate it;
- list, search and filter user accounts across the platform; open one; deactivate or reactivate it.

This is the first time a real clinic can be created over HTTP (until now only the dev seed could), so it is what lets pilot clinics be onboarded.

## 2. Decisions

| #    | Decision                                                                                                                                                                                                                                                                                                                                            | Why                                                                                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P4-1 | **Tabs in the same app, not a separate deployment.** Q6 is revised (owner, 2026-11-23). The Clinics and Users tabs are routes of this app, shown only when `GET /me` → `platformRole` is `platform_admin`.                                                                                                                                         | The backend designed it this way (one session, one sign-in, no operator auth). One build, one host, one CSP; the design system is reused as is.                                                     |
| P4-2 | Admin screens are **lazily loaded route chunks** (TanStack Router `autoCodeSplitting`, already on). A clinic user never downloads them.                                                                                                                                                                                                              | Keeps the startup budget (plan.md §11) for everyone; each admin chunk stays under 100 kB gzip.                                                                                                      |
| P4-3 | Show or hide the tabs from **`platformRole` only**, never from an email or a role name. Hiding is convenience: the server refuses `/admin/*` to anyone else.                                                                                                                                                                                          | Same rule as clinic permissions (plan.md §5.5).                                                                                                                                                      |
| P4-4 | A person who is not a platform admin and opens `/admin/...` sees **"Page not found"**, not "no access".                                                                                                                                                                                                                                             | Does not tell a clinic user that an admin area exists.                                                                                                                                               |
| P4-5 | **Deactivating a clinic needs typed confirmation**: the admin types the clinic's slug. Suspend and the user status changes use the normal confirmation dialog.                                                                                                                                                                                       | Deactivation is one-way and locks every member out. Typing is an exception to the plain-confirmation rule, for internal operators only.                                                             |
| P4-6 | **Search text never goes in the URL** (it may be an email address; AGENTS.md: no typed form value in a URL). The status filter and the page number do go in the URL, so Back and a reload keep them. The search text stays in memory and is lost on reload.                                                                                          | Privacy rule over convenience.                                                                                                                                                                       |
| P4-7 | Admin query keys start with `'admin'` (`['admin', 'tenants', filters]`), not with a clinic id. They are cleared with the rest of the cache on sign-out and clinic switch (Phase 3 already clears everything).                                                                                                                                       | `/admin/*` data does not belong to a clinic.                                                                                                                                                         |
| P4-8 | Dates in the admin tabs (`createdAt`) are shown in **the clinic's own time zone** (`timezone` on each clinic), labelled with that zone. A user row has no date.                                                                                                                                                                                      | The time zone must be an explicit argument (AGENTS.md); the clinic's own zone is the natural one and is always in the response.                                                                    |

| P4-9 | **A platform admin lands on a platform overview at `/admin`** (a dashboard of all clinics), not on the Clinics list. `/admin` was a redirect to `/admin/clinics`; it is now the overview. Added 2026-11-23 after the owner asked for it. | The admin's job is to watch all clinics, and the overview is where they see them together. The Clinics and Users tabs stay the places to search and act. |
| P4-10 | **The overview shows only what `/admin/*` and the health endpoint return, and says which parts are sample data.** Real: clinic and account counts by status, suspended clinics, accounts waiting to set a password, the first clinics by name, whether the service is ready. Static: the "Activity across clinics" block (appointments, patients seen, sign-ins, busiest clinics), clearly labelled "Sample data". | The platform role grants no clinic data (plan above), and there is no endpoint for platform-wide activity yet (D-31). A sample figure that looks real would mislead an operator, so every static number is labelled. |

## 3. Start condition

Phase 4 builds on the Phase 3 session, guards and shell. Before it starts, Phase 3 should be finished: in particular the global error handling (a `FORBIDDEN` refetches `GET /me`), and the e2e infrastructure (mail catcher, so the e2e can open the owner's setup link). If Phase 4 starts earlier, M1 below must include the `FORBIDDEN` → refetch handling itself.

## 4. What changes in existing code

| Area                                         | Today (Phase 3)                                                                                   | After Phase 4                                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract                                     | `docs/openapi.json` has no `/admin/*`, no `platformRole`, no `SELF_ACTION_FORBIDDEN`               | `npm run api:sync` brings the backend's contract (7 admin operations, `platformRole`, and the other backend Phase 4 endpoints, which only add types). New codes `SELF_ACTION_FORBIDDEN`, `LAST_OWNER`, `OWNER_REQUIRED` get catalogue messages (`error-messages.spec.ts` fails until they do).     |
| Session store                                | `signed-in` has `user`, `memberships`, `activeTenantId`, `permissions`                            | Adds `platformRole: 'none' \| 'platform_admin'`, read from `GET /me` in `loadSession` and refreshed with the permissions.                                                                                                                                                                         |
| Routes                                       | `_app` layout needs a signed-in session **and** an active clinic; `/` and `/account` live in it    | `_app` (shell) needs only a signed-in session. Inside it: `_clinic` (needs an active clinic: `/`, later every clinic page), `/account` (no clinic needed, plan.md §5.2), and `admin` (needs `platform_admin`: `/admin/clinics`, `/admin/clinics/new`, `/admin/clinics/$tenantId`, `/admin/users`, `/admin/users/$userId`). |
| Where a person lands after sign-in or at `/` | No active clinic → `/select-clinic`                                                               | A platform admin with **no usable membership** → `/admin`, the platform overview (never the clinic picker). A platform admin with memberships → as today (clinic home, or the picker), with the admin tabs added. Everyone else → as today.                                                                     |
| Clinic picker                                | "You don't have a clinic you can open right now" for anyone with no usable clinic                 | Same for non-admins. A platform admin also gets a "Go to the platform overview" link there.                                                                                                                                                                                                                      |
| App shell                                    | Always shows a clinic switcher                                                                    | With no active clinic (an admin-only session) the clinic slot shows "DocTayo admin" instead of a switcher. Navigation: the clinic items (from `permissions`) when a clinic is active, then **Overview**, **Clinics** and **Users** when `platformRole` is `platform_admin`.                                    |
| `ConfirmDialog`                              | Plain confirmation                                                                                | Optional `typeToConfirm` (the text to type, with a visible label and hint); the confirm button stays available and explains what is missing until the text matches (no bare disabled button). New story and spec.                                                                              |

## 5. Screens

All text in the English catalogue. Each list uses `DataTable` + `Pagination` + `SearchField` from the design system; each form uses `FormErrorSummary` + `applyApiErrors`.

### 5.0 Platform overview (`/admin`) (M6)

The landing page of a platform admin: one screen for all clinics. One level-1 heading, "Platform overview", with the line "All clinics on DocTayo" under it. It has no primary button: the list and the form have their own.

| Block | Content | Data |
| ----- | ------- | ---- |
| **Clinics at a glance** | Four tiles: All clinics, Active, Suspended, Deactivated. Each tile is a link to the Clinics list with that status filter. | **Real.** Three calls `GET /admin/tenants?status=…&pageSize=1`; the number is `meta.totalItems`. "All clinics" is their sum. |
| **People** | Four tiles: All accounts, Active, Waiting to set a password (pending), Deactivated. Each links to the Users list with that filter. | **Real.** Three calls `GET /admin/users?status=…&pageSize=1`. |
| **Needs attention** | Two lists of up to five: "Suspended clinics" (name links to the clinic) and "Accounts waiting to set a password" (name and email link to the account). Each has a "View all" link and an empty text ("No clinics are suspended." / "Nobody is waiting."). | **Real.** `GET /admin/tenants?status=suspended&pageSize=5`, `GET /admin/users?status=pending&pageSize=5`. |
| **All clinics** | A table of the first 10 clinics by name (name, status in words, active members, time zone) and a button "View all clinics" to `/admin/clinics`. This is how an admin sees every clinic without a switcher. | **Real.** `GET /admin/tenants?pageSize=10`. With more than 10, the text says "Showing 10 of N clinics". |
| **System status** | "The service is ready" or "The service is not ready right now", and a Check again button. | **Real.** `GET /api/health/ready` (a 503 means not ready). |
| **Activity across clinics** | Three tiles (Appointments today, Patients seen today, Sign-ins today) and a small table "Busiest clinics today" (three rows). | **Static sample data.** A visible "Sample data" label on the block, and the numbers are marked "(sample)" for screen readers. No network call. To be replaced when the backend has platform-wide numbers (D-31); until then it must not be read as real. |

Rules: each real block loads and fails **on its own** (an error with the request id and Try again inside that block; the rest still shows); counts show a skeleton while loading, never `0`; every number has a visible label; the tiles are links, at least 44 px high; status is always in words. A platform admin who also belongs to a clinic still lands on the clinic home at `/` (as today) and reaches the overview from **Overview** in the navigation.

### 5.1 Clinics: list (`/admin/clinics`)

- `GET /admin/tenants?page=&pageSize=20&q=&status=`. Columns: name (link to detail), slug, status (a `StatusPill` with the word, never colour alone), time zone, active members, created (date in the clinic's zone, P4-8).
- Search (name or slug) runs on submit and on a short pause in typing; it resets to page 1. Status filter: All, Active, Suspended, Deactivated (in the URL, P4-6).
- One primary action: **New clinic**.
- States: loading (skeleton rows), empty ("No clinics yet" with New clinic), no results ("No clinics match …" with Clear search), error (message + request id + Try again).

### 5.2 Clinics: detail (`/admin/clinics/$tenantId`)

- `GET /admin/tenants/:tenantId`: name, slug, status, time zone, created, active members, and the active **owners** (name and email). Unknown id (`404 NOT_FOUND`): back to the list with "This clinic does not exist".
- Status actions, only those allowed from the current status:

| Status        | Actions                                                     |
| ------------- | ----------------------------------------------------------- |
| `active`      | Suspend, Deactivate                                         |
| `suspended`   | Reactivate (primary), Deactivate                            |
| `deactivated` | none; a note says deactivation is permanent                 |

- Each action is `PATCH /admin/tenants/:tenantId/status`, confirmed first, and says what happens: suspend "Everyone at {clinic} loses access until you reactivate it"; deactivate "Everyone at {clinic} loses access permanently. This cannot be undone." with typed confirmation (P4-5).
- `204` → refetch the clinic and the list; confirmation toast. `409 CONFLICT` (not allowed, or another admin changed it first) → refetch and show "This clinic was changed by someone else. Check its status and try again." on the page.
- Read-only: there is no endpoint to edit a clinic's name or contact details, list its staff, or resend the owner's setup link (guide §6). The page says "To change these details, the clinic's owner signs in and edits them" instead of showing disabled buttons.

### 5.3 Clinics: new (`/admin/clinics/new`)

- Fields: Clinic name (required, at most 120), Web address name / slug (suggested from the name until the admin edits it; lower-case letters and digits in groups separated by single hyphens; at most 60; live hint), Owner's full name (required, at most 120), Owner's email (required, valid email), Time zone (`Combobox` of IANA names from `Intl.supportedValuesOf('timeZone')`, defaulting to Asia/Manila).
- Client checks mirror the server's rules; the server decides. `400 VALIDATION_FAILED` → each detail under its field. `409 CONFLICT_UNIQUE` → "This web address name is already used. Choose another." on the slug field, keeping everything typed.
- `201` → open the new clinic's detail page with the confirmation "Clinic created. We emailed {ownerEmail} with what to do next." (an account-setup link for a new owner, an ownership notice for an existing account; the page does not say which, because it cannot know).

### 5.4 Users: list (`/admin/users`)

- `GET /admin/users?page=&pageSize=20&q=&status=`. Columns: name (link to detail), email, status (Pending, Active, Deactivated), a "Platform admin" badge when `platformRole` is `platform_admin`, clinics (`membershipCount`).
- Search by name or email (memory only, P4-6); status filter in the URL. Same loading, empty, no-results and error states as Clinics.

### 5.5 Users: detail (`/admin/users/$userId`)

- `GET /admin/users/:userId`: the same fields. `404` → back to the list with a message.
- `active` → **Deactivate** ("{name} is signed out on every device and cannot sign in until reactivated"). `deactivated` → **Reactivate**. Both via `PATCH /admin/users/:userId/status` with a confirmation dialog.
- `pending` → no buttons; a note: "This person has not set a password yet. They activate their account from the link we emailed them."
- **The admin's own account** → no status buttons; a note: "You cannot change the status of your own account." (`403 SELF_ACTION_FORBIDDEN` is still handled with the same text.)
- `409 CONFLICT` → refetch and show the message, as for clinics.

### 5.6 Errors in the admin tabs

| Code                           | Do this                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FORBIDDEN` (on `/admin/*`)    | The role was taken away: refetch `GET /me`; the tabs disappear and the route guard shows "Page not found" (the same as for a clinic user). |
| `SELF_ACTION_FORBIDDEN`        | The note in §5.5.                                                                                                                                                |
| `NOT_FOUND`                    | Back to the list with a message.                                                                                                                                 |
| `CONFLICT`                     | Refetch the record; message on the page.                                                                                                                         |
| `CONFLICT_UNIQUE`              | Slug field (§5.3).                                                                                                                                               |
| `VALIDATION_FAILED`            | Each detail under its field.                                                                                                                                     |
| `401`, `ACCESS_TOKEN_EXPIRED`, `429`, network | As everywhere (Phase 3).                                                                                                                         |

## 6. Code layout

```
src/features/admin/
  api/            useAdminTenants, useAdminTenant, useCreateTenant, useSetTenantStatus,
                  useAdminUsers, useAdminUser, useSetUserStatus (TanStack Query; keys start with 'admin')
  overview/       AdminOverviewPage, CountTile, SampleActivity (static), SystemStatus; hooks in api/admin-overview.ts
  clinics/        ClinicsListPage, ClinicDetailPage, NewClinicForm, clinic-status.ts (allowed transitions), slug.ts (suggest + check)
  users/          UsersListPage, UserDetailPage, user-status.ts
src/routes/_app/admin/...   thin route files (guard + compose)
src/app/guards.ts           requirePlatformAdmin, landing rule
```

`clinic-status.ts` and `user-status.ts` hold the transition tables (§5.2, §5.5) as plain data, so the buttons and their specs read from one place.

## 7. Backend endpoints

All available ([platform-admin-integration.md](../docs/platform-admin-integration.md); tag `admin` in the contract):

| Call                                         | Used by    |
| -------------------------------------------- | ---------- |
| `GET /me` (`platformRole`)                   | tabs, guards |
| `GET /admin/tenants`, `GET /admin/tenants/:tenantId` | §5.1, §5.2 |
| `POST /admin/tenants`                        | §5.3       |
| `PATCH /admin/tenants/:tenantId/status`      | §5.2       |
| `GET /admin/users`, `GET /admin/users/:userId` | §5.4, §5.5 |
| `PATCH /admin/users/:userId/status`          | §5.5       |
| `GET /api/health/ready`                      | §5.0 system status |

**Not available, so not built or only sample data:** platform-wide activity numbers (D-31); also (guide §6): editing a clinic, listing its staff, granting the platform role, resending a setup link or sending a reset for someone, an audit-log viewer, two-factor sign-in for admins (backend `TODO-LATER L-06`; see §11).

## 8. Milestones and their tests (tests first in each)

Every component spec includes axe; every e2e page calls `expectNoAxeViolations`.

### M0: Contract

- Run `npm run api:sync`; `npm run api:check` passes.
- Red first: `error-messages.spec.ts` fails for `SELF_ACTION_FORBIDDEN`, `LAST_OWNER`, `OWNER_REQUIRED`; add the messages; green.

### M1: Session, routes and shell

Specs: `session.spec.ts` (platformRole read from `/me`, refreshed by `refreshPermissions`), `routes.spec.tsx` (route matrix), `AuthenticatedShell` spec, `confirm-dialog.spec.tsx` (typed confirmation).

- Admin with no memberships signs in → `/admin/clinics`; `/` → `/admin/clinics`; `/select-clinic` offers "Go to Clinics"; no clinic switcher; nav shows Clinics and Users only.
- Admin with a clinic → clinic home; nav shows clinic items and Clinics, Users.
- Clinic owner, receptionist → no Clinics/Users items; `/admin/clinics` → "Page not found".
- `/account` opens without an active clinic.
- `FORBIDDEN` from an admin query → `/me` refetched, tabs gone, redirect with the notice.
- `typeToConfirm`: confirm does nothing and says what to type until the exact text is entered; Escape cancels; focus returns.

### M2: Clinics list and detail

Specs (MSW): list renders columns and status words; search resets to page 1 and the text is **not** in `location.href`; status filter is in the URL and survives a reload; pagination; empty / no results / error with request id. Detail: owners; buttons per status from the transition table (all three statuses); confirm texts; deactivation typed confirmation; `204` refetches; `409` message; `404` back to list; dates shown in the clinic's zone with the runner in New York (and the Manila pass).

### M3: New clinic

Specs: required fields; slug suggestion from the name ("Bayview Clinic" → `bayview-clinic`; accents and `ñ` → plain letters; repeated or edge hyphens removed; capped at 60), stops following the name once edited; invalid slug hint; time zone defaults to Asia/Manila; sends exactly `{ name, slug, ownerEmail, ownerFullName, timezone }`; `400` details on fields; `409 CONFLICT_UNIQUE` on slug keeping input; `201` → detail with the confirmation.

### M4: Users list and detail

Specs: list and filters as for clinics; Platform admin badge; buttons: active → Deactivate, deactivated → Reactivate, pending → note and no buttons, own row → note and no buttons; `SELF_ACTION_FORBIDDEN` and `409` handling.

### M5: End-to-end (real API, `tests/e2e/platform-admin.spec.ts`)

Seed: `admin@doctayo.test`, `owner@sunrise.test`, `reception@sunrise.test` (`db:seed:dev`). Mutating tests run **only in the chromium project and serially**, use a unique slug per run (`e2e-<timestamp>`), and never change the seeded Sunrise clinic or seeded users' final state.

1. Admin signs in → lands on Clinics; no clinic picker or switcher.
2. Create a clinic with a new owner email → its detail page; the owner's setup email arrives (mail catcher) and its link opens `/account-setup` (Phase 3 page) and works; the new owner signs in to the new clinic.
3. Suspend that clinic → its owner gets the `TENANT_SUSPENDED` handling on the next request; reactivate → access back; deactivate with typed confirmation → no buttons left.
4. Users: deactivate the new owner → their open session ends and sign-in is refused; reactivate → sign-in works.
5. The admin's own row has no status buttons.
6. Receptionist: no admin tabs; `/admin/clinics` shows "Page not found"; a direct `GET /admin/tenants` with their token answers `403` (security check).
7. Slug clash: creating a second clinic with the same slug shows the slug error.
8. axe on every admin page, at 1280 px and 360 px.

Deactivated test clinics accumulate in the dev database (there is no delete endpoint); their names start with "E2E" so they are easy to spot.

### M6: Platform overview (added 2026-11-23)

Specs first, red for the right reason:

- `AdminOverviewPage.spec.tsx` (MSW): the clinic and account tiles show `meta.totalItems` of each status call and "All clinics" is their sum; each tile links to the list with its status (`/admin/clinics?status=suspended`); a skeleton while loading, never `0`; suspended clinics and pending accounts listed (at most five) with working links, and their empty texts; the clinics table shows 10 rows and "Showing 10 of N clinics" with a link to `/admin/clinics`; system status ready and not ready (503) and Check again; **one failing call fails only its block** (the others still render); the sample block is labelled "Sample data", makes no request, and its numbers are marked "(sample)"; axe in each state.
- `routes.spec.tsx`: an admin with no clinic lands on `/admin` (heading "Platform overview"); the navigation shows Overview, Clinics, Users (and Home if they have a clinic); `/admin` for a clinic user is "Page not found"; `/` still redirects an admin-only session to `/admin`; the clinic picker's link is "Go to the platform overview" and goes to `/admin`.
- e2e (`platform-admin.spec.ts`): the first test lands on the overview; the **All clinics** tile equals the count the Clinics list reports ("N clinics found"); the Suspended tile link opens the filtered list; axe at 1280 px and 360 px; no sideways scrolling.

## 9. Acceptance criteria

- Every milestone's specs pass (New York and Manila runs), plus lint, format check, typecheck, `tokens:check`, `api:check`, `i18n:check`, build.
- Startup JavaScript does not grow because of the admin screens (they are lazy chunks, each under 100 kB gzip). Note: the startup budget already fails after Phase 3 (179.3 / 170 kB); that is decided separately.
- The M5 e2e passes in Docker against the real API.
- The platform overview shows real counts for every clinic and labels all sample data (M6).
- A clinic user never sees or downloads the admin screens; a platform admin never sees clinic data unless they are a member of that clinic.
- `plan.md`, this plan's "As Built", `AGENTS.md` (query keys for admin data) and the ADR for the session (platform role) match the code.

## 10. Accessibility and UX notes

- Status shown in words, with the pill colour as a second cue.
- Tables reflow at 320 px (a table may scroll in its own box only).
- One primary action per screen (New clinic on the list; on a detail page, the most likely safe action, for example Reactivate).
- Destructive actions name the clinic or person and the consequence; Cancel gets the initial focus.

## 11. Open questions

- **Q18: Two-factor sign-in for platform admins.** The backend lists it as later (`TODO-LATER L-06`). Until then, an admin account is protected only by its password. Recommendation: ask the backend to schedule it before real pilot clinics are onboarded; meanwhile admins use personal devices only and a long unique password. (Backend dependency D-28.)
- **Q19: Who are the platform admins, and how many?** The role is granted only on the server (`npm run admin:grant`). Affects nothing in the UI; noted for operations.
- **Q20: Resending a clinic owner's setup link.** Not possible today (no endpoint). If an owner loses the email, the only way is the backend's tooling. Recommendation: ask the backend for `POST /admin/tenants/:id/owners/:userId/resend-setup` (D-29).

- **Q21: Which numbers should the overview show once the backend has them?** Candidates: appointments and revenue per clinic, sign-ins, newest clinics, clinics with no sign-in for 30 days. The sample block shows the shape only (backend dependency D-31).
- **Gotcha: a stale API.** `GET /me` must return `platformRole`; an API process started before that field existed does not, and the app then treats an admin as a clinic user with no clinic (the clinic picker's "You don't have a clinic you can open right now"). `nest start` without `--watch` never reloads: restart the API after the backend changes.

## As Built

Built 2026-11-23, milestone by milestone, tests first. **Verified:** tsc, eslint, Prettier, `tokens:check`, `api:check`; Vitest 80 files, 1066 specs (New York time), the Manila pass of `src/lib` and `src/test` (67); Playwright on the `chromium` and `mobile` projects against the real API (67 passing, 13 skipped: the admin spec runs in `chromium` only). The overview was also looked at in a screenshot (1280 px). **Not verified:** Firefox and WebKit (their system libraries are missing on this machine; they need the Docker e2e image), and the Docker compose e2e run itself (the new mail volume in `compose.yaml` is covered only by `scripts/docker-files.spec.ts`).

What was built:

- **M0** `npm run api:sync` (44 operations); messages for `LAST_OWNER`, `OWNER_REQUIRED`, `SELF_ACTION_FORBIDDEN`.
- **M1** `platformRole` in the session (read in `loadSession`, kept on clinic switch, refreshed by `refreshPermissions`); routes `_app` (signed in) > `_clinic` (needs a clinic: `/`), `account` (no clinic), `admin` (needs `platform_admin`, else the router's not-found); an admin with no usable clinic lands on `/admin/clinics`; clinic picker "Go to Clinics" link; shell with no clinic switcher for an admin-only session and Clinics/Users items; `ConfirmDialog` `typeToConfirm`; `createQueryClient` (a `FORBIDDEN` on any query or mutation refreshes `GET /me`).
- **M2** Clinics list (`/admin/clinics`; search text in memory only, page, page size and status in the address) and detail (`/admin/clinics/$tenantId`; transitions from `clinic-status.ts`; deactivation needs the slug typed).
- **M3** New clinic form (`/admin/clinics/new`; slug suggested from the name, time zone combobox defaulting to Asia/Manila; `409 CONFLICT_UNIQUE` on the slug field).
- **M4** Users list and detail (`/admin/users`, `/admin/users/$userId`; none for pending accounts or your own account).
- **M6** Platform overview at `/admin` (`src/features/admin/overview/`): the landing page of an admin with no clinic (`requireClinic` now redirects to `/admin`); an **Overview** item in the navigation; blocks that load and fail on their own: clinic counts by status and account counts by status (each a link to the filtered list; `pageSize=1` calls read `meta.totalItems`; "All" is the sum), suspended clinics and accounts waiting to set a password (up to five each), the first 10 clinics with "Showing 10 of N clinics", system status from `GET /api/health/ready`, and the **static** "Activity across clinics" block labelled "Sample data" (numbers marked "(sample)" for screen readers). The clinic picker's admin link is "Go to the platform overview".
- **M5** `tests/e2e/platform-admin.spec.ts` (12 tests, including the overview agreeing with the Clinics list: sign in as `admin@doctayo.test`, create a clinic with a new owner, the owner opens the emailed setup link and signs in, suspend/reactivate/deactivate, user deactivate/reactivate with sign-in refused, own account, 360 px reflow, receptionist refused in the screens and by the API with 403). axe and CSP checks after every test.

Deviation from M6 as planned: none. Deviations from the plan above (the plan body was edited to match where it said otherwise):

1. **A lost platform role shows "Page not found"**, not a redirect with a notice (§5.6 changed): it is the same screen a clinic user sees, and needs no extra notice state.
2. **The contract declares no path parameters** (new backend dependency D-30). `src/api/path-params.ts` is the one workaround.
3. **A design-system defect was found and fixed**: Radix modals (`Dialog`, `AlertDialog`, `DropdownMenu`, `Popover`) insert a `<style>` element for their scroll lock (`react-remove-scroll`), which the production CSP forbids. Nothing had opened a modal in a real browser with the CSP check until the e2e did. `src/design-system/scroll-lock.tsx` replaces the library through a build alias (`vite.config.ts`, `vitest.config.ts`, `.storybook/main.ts`): a `data-scroll-locked` attribute styled in `index.css`, with the scrollbar width kept as padding set through the CSS object model. Regression spec in `dialog.spec.tsx`.
4. **E2E specs that are not about signing in no longer call the API at page load.** Every page load restores the session with `POST /auth/refresh` (30 a minute per address), so the gallery and smoke specs exhausted the limit when run in parallel. The shared `page` fixture answers it with 401 unless `realSession` is set (`tests/e2e/fixtures/test.ts`). `expectNoAxeViolations` also waits for finite animations to end.
5. **The e2e needs file mail and a shared mail volume.** `compose.yaml`: `MAIL_TRANSPORT` is `${MAIL_TRANSPORT:-log}` (still `log` by default), the API writes to the `mail` volume, the e2e container reads it at `/mail` (`E2E_MAIL_DIR`). For the admin spec run `MAIL_TRANSPORT=file docker compose up -d api` first. Without Docker: run the API with `MAIL_TRANSPORT=file`, `CORS_ALLOWED_ORIGINS` and `APP_PUBLIC_URL` set to `http://localhost:4173`, and run `VITE_API_ORIGIN=<its origin> npx playwright test --project=chromium`. That is how it was verified here (a second API instance on port 4100 against the local database).
6. **Not covered by e2e:** what a clinic's own members see after the clinic is suspended (`TENANT_SUSPENDED` handling is Phase 3 global error handling, not built yet).

Known issues:

- **Startup JavaScript is over budget: 192.0 kB of 170 kB gzip** (164.7 before Phase 3, 179.3 after the account page, 190.4 after the admin tabs). The admin screens are lazy chunks and none exceeds 100 kB; the growth is shared code (router, form and design-system modules pulled into the startup path by the session boot). Either trim it or raise the budget in plan.md §11: not decided.
- **The activity block is static on purpose** (backend request D-31, question Q21); nothing in it comes from the API.
- Each e2e run leaves a deactivated "E2E Clinic ..." and an "E2E Owner" user in the database (no delete endpoints).
- The admin sign-in has no second factor yet (Q18, D-28).
