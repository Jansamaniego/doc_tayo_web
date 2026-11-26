# Phase 5: Staff, invitations, account and clinic settings (sub-phases 5.1–5.6)

Status: **5.1 to 5.6 built** (2026-11-23 and 2026-11-24, see "As Built"); the cross-browser and remaining M7 end-to-end items are not done (written 2026-11-23). Backend: **available** (backend Phase 4, commit `c14e285`; [docs/staff-management-integration.md](../docs/staff-management-integration.md), [docs/frontend-integration.md](../docs/frontend-integration.md) §5–§9). The contract in `docs/openapi.json` already contains every endpoint used here (checked: identical to the backend's copy on 2026-11-23), so no `api:sync` is needed to start. Depends on Phase 3 (session, guards, shell, the token pages) and reuses what Phase 4 built (lists, filters, status tables, `ConfirmDialog`, the mail fixture).

The work is split into six sub-phases, each built and verified on its own, in this order. 5.1–5.3 are the owner and clinic-admin screens; 5.4 is for every user; 5.5 is the app's reaction when an admin changes **your** membership; 5.6 is the clinic profile and its branches (added 2026-11-23, Q22).

| Sub-phase | Milestone | Who uses it | What it adds |
| --------- | --------- | ----------- | ------------ |
| 5.1 Staff tab: read-only | M1 | Owner, clinic admin | Staff navigation item, staff list (search, status filter, pagination), member detail, roles reference |
| 5.2 Staff tab: changes | M2 | Owner, clinic admin | Edit roles and job title; suspend, reactivate, remove; owner-only rules |
| 5.3 Invitations | M3 | Owner, clinic admin | Invitations tab (by status), invite, resend, revoke |
| 5.4 Account: profile and email | M4 | Every signed-in user | Edit name, change email, the public `/verify-email` page |
| 5.5 Reacting to changes made to you | M5 | Every clinic user | Role change, suspension, removal and reactivation take effect in the open app |
| 5.6 Clinic profile and branches | M6 | Every clinic user reads; owner and clinic admin edit | Clinic navigation item, clinic profile (name, time zone, contact details), branch list, add, edit, deactivate and reactivate a branch |

The end-to-end runs for all six sub-phases are milestone M7. The **branch selector** in the top bar stays a Phase 3 item (plans/03-app-shell-auth.md); 5.6 only manages the branches it will list.

## 1. Objectives

- An owner or clinic admin can see the clinic's staff, change their roles and job title, suspend, reactivate and remove them, and manage invitations, **without being able to break the clinic's ownership** (the server's owner rules are explained in the UI before anyone hits them).
- Every user can correct their own name and change their email address safely.
- A person whose membership is changed by an admin is never left on a broken screen: the next request takes them to a page that makes sense.
- An owner or clinic admin can keep the clinic's name, time zone and contact details correct and manage its branches; every other member can look them up.

## 2. Decisions

| #     | Decision | Why |
| ----- | -------- | --- |
| P5-1  | **One navigation item, "Staff"** (requires `members.read`), with two tabs as routes: **Staff** (`/staff`) and **Invitations** (`/staff/invitations`). Member detail is `/staff/$membershipId`. Invite is a dialog on the Invitations tab. | People and pending invitations are one job for the admin. Tabs as routes keep Back, reload and links working. |
| P5-2  | **Edits and status actions live on the member detail page**, not in the list rows. The list is for finding people. | One primary action per screen (AGENTS.md); room to explain each action and its consequence. |
| P5-3  | **"Is the signed-in person an owner?" comes from `GET /roles`:** the role with key `owner` has `assignable: true` only for owners. "Is the target an owner?" comes from the member's `roles` (key `owner`). This is a documented exception to "decide from permissions, not role keys" (plan.md §5.5): the owner rule is not a permission, and the backend guide prescribes exactly this. Both are convenience: the server decides (`OWNER_REQUIRED`). | `GET /roles` is fetched with the screen, so it is fresher than the memberships held in the session since sign-in. |
| P5-4  | The **signed-in person's own row** is found with `member.userId === session.user.id`. | `GET /me` has no membership id; the user id is in the session already. |
| P5-5  | Which buttons a row shows is **plain data** in `member-actions.ts` (the rules of the guide's 4.2 table, in its order), and the invitation buttons in `invitation-actions.ts`. Screens and specs read from one place, as `clinic-status.ts` does in Phase 4. | One source for the rules and their tests. |
| P5-6  | **Search text never goes in the URL** (it may be an email address); the status filter and page do (same as P4-6). | AGENTS.md: no typed form value in a URL. |
| P5-7  | **Query keys for clinic data start with the active clinic id**: `[tenantId, 'members', …]`, `[tenantId, 'invitations', …]`, `[tenantId, 'roles']`, `[tenantId, 'tenant']`. A mutation invalidates its whole group (`[tenantId, 'members']`). | AGENTS.md rule; the cache is already cleared on clinic switch. |
| P5-8  | **Dates** (`joinedAt`, invitation `createdAt` / `expiresAt`) are shown in the **clinic's time zone** from `GET /tenant` → `timezone` (owner and clinic admin hold `tenant.read`), labelled with the zone. | The time zone is always an explicit argument (AGENTS.md); plan.md §5.6 names the clinic zone. |
| P5-9  | **Suspend and Remove use the normal `ConfirmDialog`** (no typed confirmation). Remove says it cannot be undone here and that the person can be invited again. | Both are recoverable (reactivate, or a new invitation); typed confirmation stays an exception for irreversible platform actions (P4-5). |
| P5-10 | The `invited` member status is **not offered as a filter** (the API never creates it; people who have not joined are in Invitations). If a row ever has it, it shows the word "Invited" and no actions. | Guide 4.1. |
| P5-11 | **The email-change confirmation never says whether the address is free.** One message for every `202`. | The API hides it on purpose (no enumeration). |
| P5-12 | `/verify-email` is a **public token page** like `/reset-password`: it reads and removes the fragment token, posts it, and on `204` **ends the local session** (the server has revoked every session) and goes to sign-in with a new notice `email-changed`. A signed-in person may open it (it does not redirect them away). | Guide 4.4; plan.md §5.2 (token pages are the exception to "leave if signed in"). |
| P5-13 | **Losing access to the clinic is handled once, globally** (5.5): a `TENANT_NOT_SELECTED` or `TENANT_ACCESS_DENIED` from any query or mutation reloads the session (`refreshPermissions`); the clinic guard then sends the person to `/select-clinic` with the notice "You no longer have access to {clinic}." This is part of the Phase 3 global error handling (plan.md §5.7), built here because 5.5 needs it. | The member is not told by push; their next request is the only signal. |
| P5-14 | **One navigation item, "Clinic"** (requires `tenant.read`, which every clinic role holds), with two tabs as routes: **Profile** (`/clinic`) and **Branches** (`/clinic/branches`). Branch pages are `/clinic/branches/new` and `/clinic/branches/$branchId`. Without `tenant.settings.manage` (profile) or `branches.manage` (branches) the pages are **read-only with a reason**, never bare disabled buttons. | Reception needs branch addresses and the clinic's contact details; AGENTS.md: show read-only with a reason, hide only what a role can never do. |
| P5-15 | **Edit forms send only the changed fields**; an emptied optional field sends `null`; nothing changed means no request ("Nothing to change"). Profile and branch edits are **last save wins**: the API has no version check and no `CONFLICT` for them. | Same rule as the member edit (5.2); the API's PATCH semantics. |
| P5-16 | **One time-zone list**: `timeZoneOptions()` moves from `NewClinicForm` to `src/lib/datetime/` (the profile and branch forms are its second and third users). A branch's empty time zone means "the clinic's", shown as "Clinic's ({zone})". | No copy of the list per form; the datetime folder owns zones. |
| P5-17 | **After a profile save**: every query under `[tenantId]` is invalidated (dates follow the clinic's zone), and a **name change reloads the session** (`refreshPermissions`, which refetches `GET /me` and `GET /me/memberships`) so the clinic switcher and picker show the new name. | Checked: `loadSession` fetches both (`src/api/session/session.ts`). |
| P5-18 | **Branch query keys** are `[tenantId, 'branches', …]`; every branch change invalidates the group, so the Phase 3 branch selector (when built) shows the change at once. | AGENTS.md key rule; one cache for both users. |
| P5-19 | **Contact phone**: spaces, dashes, dots and brackets are removed before checking and sending; the result must match the API's international format (`+` and 7–15 digits, for example `+639171234567`). The hint shows the format; the field never guesses a country code. | The API accepts only `^\+[1-9]\d{6,14}$`; guessing `+63` would store a wrong number for a foreign one. |

## 3. Start condition

- Phase 3 pieces used here exist: session store with `refreshPermissions`, `requireClinic`, the shell's permission-filtered navigation, `createQueryClient`, the token-page helpers (`fragment-token.ts`, `token-form-parts.tsx`), the clinic picker. Phase 3's remaining items (branch selector, inactivity sign-out, offline banner) are **not** needed.
- Test data: the dev seed has an owner and a receptionist in Sunrise Clinic (branches "Main" and "Quezon City Annex"). The seed now also has `clinic-admin@sunrise.test` and `doctor@sunrise.test` (Q23, D-32 done) for manual checks, and a second clinic, "Lakeside Family Clinic" (`owner@lakeside.test`), with `multi@doctayo.test`, one account in both clinics (clinic admin in Sunrise, doctor in Lakeside) for the clinic picker, the switcher and the "Staff is hidden in one clinic only" check. The e2e never depends on them: it creates its clinic admin through an invitation (M3). Component specs use MSW.

## 4. What changes in existing code

| Area | Today | After Phase 5 |
| ---- | ----- | ------------- |
| Clinic pages that need a permission | None | A `<RequirePermission permission="…">` gate (`src/app/RequirePermission.tsx`, built in 5.1) wraps the route's `Outlet`: without the permission the page shows `NoAccess` ("You don't have access to this page") and its children never render, so they never ask for the data. |
| Query client | Retries every failed read three times | Does not retry a `4xx` answer (it would not change), built in 5.1: a missing person or branch goes back to the list at once. |
| Shell navigation | Home, plus the admin items | Adds **Staff** (`/staff`, `requires: 'members.read'`), after Home, hidden for doctor, nurse, receptionist; and **Clinic** (`/clinic`, `requires: 'tenant.read'`), after Staff, for every clinic role (P5-14). |
| `src/lib/permissions.ts` | Comment lists five keys | Lists the seven current keys (adds `members.read`, `members.manage`). |
| Account page | Read-only details; "To change your name or email, ask your clinic admin." | Name editable (`PATCH /me`); "Change email" section (`POST /me/email`); the old sentence removed. The page keeps reading the name and email from the session and updates it after a save. |
| Routes | Token pages: reset, setup, accept-invitation | Adds public `/verify-email` (P5-12); `/login` gains the notice `email-changed`. |
| `createQueryClient` | `FORBIDDEN` → `onForbidden` | Also `TENANT_NOT_SELECTED` / `TENANT_ACCESS_DENIED` → `onClinicLost` (P5-13). |
| Clinic picker | Notices for the picker's own cases | Adds the "You no longer have access to {clinic}" notice. |
| e2e mail fixture | `findSetupLink({ to })` | Generalised to `findEmailLink({ to, path })` for `/account-setup`, `/accept-invitation` and `/verify-email`; `findSetupLink` becomes a call to it. |
| e2e accounts | owner, receptionist, admin | Unchanged; the clinic admin is created per run (M3), although the seed now has one (D-32). |
| Time-zone list | Built inside `NewClinicForm` | `timeZoneOptions()` in `src/lib/datetime/`, used by the new-clinic, profile and branch forms (P5-16). |

## 5. Screens

All text in the English catalogue; lists use `DataTable` + `Pagination` + `SearchField`; forms use `FormErrorSummary` + `applyApiErrors`; status is always in words (a pill colour is only a second cue).

### 5.1 Staff tab: read-only (M1)

**Staff list (`/staff`)**: `GET /members?page=&pageSize=20&q=&status=`.

- Columns: name (link to detail), email, roles (names, comma-separated), job title, status (Active, Suspended, Removed), joined (date in the clinic's zone, P5-8). The signed-in person's row is **shown, marked "(you)"** (Q24 decided), because their job title is edited from there.
- Status filter: All (no `status`: everyone except removed), Active, Suspended, Removed (in the URL, P5-6). Search: name or email, at most 100 characters, memory only; resets to page 1.
- States: loading (skeleton rows), empty, no results ("No staff match …" with Clear search), error (message, request id, Try again).

**Member detail (`/staff/$membershipId`)**: `GET /members/:membershipId`. Name, email, status, roles, job title, joined. `404 NOT_FOUND` (unknown or another clinic's id): back to the list with "This person is not on your staff."

**Roles reference**: a "What each role can do" disclosure on the Staff tab: `GET /roles` (names and their permissions) with `GET /permissions` descriptions. Read-only.

### 5.2 Staff tab: changes (M2)

On the member detail page. The rules in `member-actions.ts` (P5-5), first match wins:

| The member is | The page offers |
| ------------- | --------------- |
| You (P5-4) | Edit job title only. Note: "Another admin must change your roles or status." |
| `removed` (or `invited`) | Nothing. Note: "To bring them back, invite them again." with a link to Invitations. |
| Holds `owner`, and you are not an owner (P5-3) | Edit job title only. Note: "Only an owner can change an owner's roles or status." |
| `active` | Edit (roles and job title), Suspend, Remove |
| `suspended` | Edit (roles and job title), Reactivate (primary), Remove |

- **Edit** (built): `PATCH /members/:membershipId` with only the changed fields. Roles: a `CheckboxGroup` of `GET /roles`, 1 to 5 selected; roles with `assignable: false` are shown with the reason ("Only an owner can give the Owner role"), not as bare disabled boxes. Job title: optional, at most 100 characters, trimmed; emptying it sends `null`. `200` → the page shows the returned member; confirmation toast.
- **Suspend** (`POST …/suspend`), **Reactivate** (`POST …/reactivate`), **Remove** (`POST …/remove`): confirmation first, naming the person and the consequence (guide 4.2), Cancel focused. `204` → refetch the member and the list; toast.
- **Owner hand-over** has no flow of its own: the detail page explains it next to the Owner role ("To hand over the clinic, give another member the Owner role; they can then remove it from you").
- After a change to **someone else**, nothing else happens in this app. After a change that affects the signed-in person's own permissions (only possible through another admin, see 5.5), `refreshPermissions` runs as usual on the next `FORBIDDEN`.

Errors (all on the page, until dismissed):

| Code | Show |
| ---- | ---- |
| `SELF_ACTION_FORBIDDEN` | "You cannot change your own roles or status. Another admin must do it." |
| `OWNER_REQUIRED` | "Only an owner can change the Owner role or an owner's status." Refetch roles and member. |
| `LAST_OWNER` | "The clinic must keep at least one active owner." Refetch. |
| `CONFLICT` | "This person was changed by someone else. Check their details and try again." Refetch. |
| `NOT_FOUND` | Back to the list with the 5.1 message (also for a role that no longer exists). |
| `FORBIDDEN` | Global: `GET /me` refetched; actions disappear (Phase 4 behaviour). |
| `VALIDATION_FAILED` | Each detail under its field. |

### 5.3 Invitations (M3)

**Invitations tab (`/staff/invitations`)**: `GET /invitations?status=&page=&pageSize=20`. Status filter Pending (default), Accepted, Revoked, Expired (in the URL). Columns: email, role, invited by, sent (`createdAt`), expires (`expiresAt`), status; dates in the clinic's zone.

| Status | Buttons (`invitation-actions.ts`) |
| ------ | --------------------------------- |
| `pending`, `expired` | Resend, Revoke |
| `accepted`, `revoked` | none |

- **Invite** (primary action, shown with `members.invite`): a dialog with Email (required, valid, at most 254) and Role (`RadioGroup` of `GET /roles` **without the Owner role**; a hint says the Owner role is given afterwards from the member's page). `POST /invitations` → `201`, the dialog closes, the Pending list reloads, toast "Invitation sent to {email}."
- **Resend**: `POST …/resend` → `200`; toast "A new link was sent. The old link no longer works." **Revoke**: confirm ("The link in their email will stop working"), `POST …/revoke` → `204`.
- Errors: `CONFLICT` on invite → on the email field "This person is already on your staff."; `CONFLICT_UNIQUE` → "An invitation to this address is already open." with a link that filters Pending; `ROLE_NOT_ASSIGNABLE` → on the role field; `CONFLICT` on resend/revoke → "This invitation was already accepted or revoked." and reload; `NOT_FOUND` → reload with a message.
- The acceptance page (`/accept-invitation`) already exists (Phase 3); nothing changes there.

### 5.4 Account: profile and email (M4)

On `/account` (no clinic needed):

- **Name**: an inline form, `PATCH /me` `{ fullName }` (required, trimmed, 1–120). `200` → the session's `user.fullName` is updated from the response (the shell's user menu shows it at once); a "Your name was saved." message in the form.
- **Change email**: New email + Current password. `POST /me/email`:
  - `202` → the form is replaced by "If {newEmail} can be used, we sent a link to it. Open it within 30 minutes. Your email does not change until you do." (P5-11) and a "Use a different address" button.
  - `400` `PASSWORD_INCORRECT` on `currentPassword`; `429` → wait message from `Retry-After` (existing rate-limit pattern).
- **`/verify-email#token=…`** (public, P5-12): reads and removes the token and shows a **Confirm new email address** button; pressing it posts `POST /auth/email/verify` `{ token }`. (Not on page load: a link opened twice, by a mail scanner or by React in development would use the single-use token up.)
  - `204` → end the local session (`endSession`, which also tells the other tabs) and go to `/login?notice=email-changed`: "Your email was changed. Sign in with your new address."
  - `400 TOKEN_INVALID` → "This link has expired, was already used, or a newer link was sent." with a link to My account (or sign-in when signed out).
  - `409 CONFLICT_UNIQUE` → "Someone else started using this address. Your email was not changed."
  - `429` → wait message.

### 5.5 Reacting to changes made to you (M5)

| An admin | The member's next request | The app (P5-13) |
| -------- | ------------------------- | --------------- |
| changed their roles | passes or answers `403 FORBIDDEN` | Existing: `GET /me` refetched, navigation and buttons rebuilt. Also refetch `GET /me` when the window regains focus (at most once a minute). |
| suspended or removed them | `403 TENANT_NOT_SELECTED` or `TENANT_ACCESS_DENIED` | Reload the session; the clinic guard goes to `/select-clinic` with "You no longer have access to {clinic}." The picker lists a suspended membership as unavailable (existing) and no longer lists a removed one. With no usable clinic left: the existing empty state. |
| reactivated them | nothing until they choose the clinic | The picker offers the clinic again; signing in selects it automatically when it is the only usable one (server behaviour). |

They stay signed in throughout; other clinics are unaffected.

### 5.6 Clinic profile and branches (M6)

**Profile (`/clinic`)**: `GET /tenant`.

- Shows name, web address (`slug`, read-only: "Set when the clinic was created; it cannot be changed"), time zone, contact email, contact phone and status in words.
- With `tenant.settings.manage`: an **Edit details** action opens the fields as a form (P5-15). Without it: the details as text and "Only an owner or clinic admin can change the clinic's details."
- Fields: Name (required, trimmed, 1–120); Time zone (`Combobox` of `timeZoneOptions()`, P5-16); Contact email (optional, valid, at most 254); Contact phone (optional, P5-19).
- **Changing the time zone asks first**: "Dates and times for {clinic} will show in {zone}. Saved times do not move; they are shown in the new zone. Branches with their own time zone keep it." Cancel is focused.
- `200` → the page shows the returned clinic; toast "Clinic details saved."; P5-17 runs.
- Errors: `VALIDATION_FAILED` details under their fields with input kept; `FORBIDDEN`: the form closes and the page shows the message; the global handler reads the session again, so the page becomes read-only.

**Branches (`/clinic/branches`)**: `GET /branches?page=&pageSize=20&isActive=`.

- Filter: a select labelled "Show": Active (`isActive=true`, default, left out of the URL), Inactive (`false`), All; in the URL with the page. No search: the API has none, and a clinic has few branches.
- Columns: name (link), city and province, time zone (or "Clinic's ({zone})"), status in words (Active, Inactive). Order as the server sends it (by name).
- States: loading, empty for the filter ("No active branches", "No inactive branches", "No branches yet"), error with request id and Try again.
- **Add branch** is the primary action, shown with `branches.manage`.

**Add branch (`/clinic/branches/new`)**: Name (required, 1–120), Address (at most 200), City and Province (at most 120 each), Time zone (optional; the first choice is "Clinic's time zone ({zone})", meaning empty, and the hint is "Leave empty to use the clinic's time zone ({zone})."). Empty optional fields are left out of the request; a new branch is always active (the form does not offer `isActive`). `POST /branches` → `201` → the branch page; toast "{name} added." `CONFLICT_UNIQUE` → on the name: "Your clinic already has a branch with this name."

**Branch page (`/clinic/branches/$branchId`)**: `GET /branches/:branchId`.

- Details; with `branches.manage`: **Edit** (the same fields, P5-15; `CONFLICT_UNIQUE` on the name as above) and **Deactivate** or **Reactivate** (`PATCH { isActive }`). Without it: read-only and "Only an owner or clinic admin can change branches."
- Deactivate asks first: "{name} will no longer be offered when staff choose a branch. Its records stay, and you can reactivate it." Reactivate needs no confirmation. Toasts confirm both.
- `404 NOT_FOUND` (unknown or another clinic's branch) → back to the list with "This branch is not in your clinic."
- **Not offered:** deleting a branch (no endpoint), and assigning staff to branches (D-9, backend `TODO-LATER L-08`).

## 6. Code layout

```
src/features/staff/
  api/            members.ts (useMembers, useMember, useUpdateMember, useSetMemberStatus),
                  invitations.ts (useInvitations, useCreateInvitation, useResendInvitation, useRevokeInvitation),
                  roles.ts (useRoles, usePermissionDescriptions), clinic-time-zone.ts (useClinicTimeZone: the zone of `useClinicProfile`, which now lives in `features/clinic/api/tenant.ts`)
  members/        StaffListPage, MemberDetailPage, EditMemberForm, MemberStatusPill, member-actions.ts (+ spec), RolesReference
  invitations/    InvitationsPage, InviteDialog, InvitationStatusPill, invitation-actions.ts (+ spec)
  StaffTabs.tsx   the Staff / Invitations tab bar (route links; built in 5.3)
src/features/account/
  profile-name-form.tsx, change-email-form.tsx (+ specs); AccountPage gains both
src/features/auth/
  verify-email-form.tsx (+ spec)
src/features/clinic/
  api/            tenant.ts (useClinicProfile, useUpdateClinicProfile), branches.ts (useBranches, useBranch, useCreateBranch, useUpdateBranch)
  profile/        ClinicProfilePage, ClinicProfileForm, contact-phone.ts (+ spec)
  branches/       BranchesPage, NewBranchPage, BranchPage, BranchForm, BranchStatusPill
  ClinicTabs.tsx  the Profile / Branches tab bar (route links; Phase 8.1 added the Services tab)
src/design-system/patterns/detail-row.tsx  one "label: value" row of a details list (shared, see As Built 5.6)
src/routes/_app/_clinic/staff/  index.tsx, $membershipId.tsx, invitations.tsx (thin: guard + compose)
src/routes/_app/_clinic/clinic.tsx  the `tenant.read` gate around /clinic/*
src/routes/_app/_clinic/clinic/ index.tsx, branches/index.tsx, branches/new.tsx, branches/$branchId.tsx
src/lib/datetime/               + timeZoneOptions() (P5-16)
src/routes/verify-email.tsx
src/app/RequirePermission.tsx   the permission gate (5.1)
src/routes/_app/_clinic/staff.tsx  the gate around /staff/* (5.1)
src/app/query-client.ts         + onClinicLost
tests/e2e/staff.spec.ts, tests/e2e/account-email.spec.ts, tests/e2e/clinic-settings.spec.ts
```

`features/staff` will hold about a dozen source files and `features/clinic` about ten, so both are grouped by concern from the start.

## 7. Backend endpoints

All available (guide sections in brackets):

| Call | Permission | Used by |
| ---- | ---------- | ------- |
| `GET /members`, `GET /members/:membershipId` | `members.read` | 5.1 |
| `GET /roles`, `GET /permissions` | `members.read` | 5.1, 5.2, 5.3 |
| `GET /tenant` | `tenant.read` | dates (P5-8), 5.6 |
| `PATCH /tenant` | `tenant.settings.manage` | 5.6 |
| `GET /branches`, `GET /branches/:branchId` | `branches.read` | 5.6 |
| `POST /branches`, `PATCH /branches/:branchId` | `branches.manage` | 5.6 |
| `PATCH /members/:membershipId`, `POST /members/:membershipId/suspend` / `reactivate` / `remove` | `members.manage` | 5.2 |
| `GET /invitations` | `members.read` | 5.3 |
| `POST /invitations`, `POST /invitations/:invitationId/resend` / `revoke` | `members.invite` | 5.3 |
| `GET /me`, `PATCH /me`, `POST /me/email` | signed in | 5.4, 5.5 |
| `POST /auth/email/verify` | public | 5.4 |
| `GET /me/memberships`, `POST /auth/switch-tenant` | signed in | 5.5 |

Path parameters are passed as `params: { path: { … } }` (declared in the contract since Phase 6.0; the `pathParams()` workaround of D-30 is removed).

**Not available, so not built** (guide "Not available in Phase 4"): custom roles and editing a role's permissions, leaving a clinic yourself, an admin-triggered password reset for a member, branch-restricted memberships, a phone number on the profile, an audit-log viewer, deleting a branch, assigning staff to branches.

## 8. Milestones and their tests (tests first in each)

Every component spec includes axe; every e2e page calls `expectNoAxeViolations`. Specs run in New York time, and date specs also in the Manila pass.

### M1: Staff tab, read-only (5.1)

- `guards` / `routes.spec.tsx`: owner and clinic admin see **Staff** in the navigation and open `/staff`; receptionist, doctor and nurse do not see it, and a typed `/staff` URL shows "You don't have access to this page" without calling `GET /members`; `/staff` with no clinic chosen → `/select-clinic`.
- `StaffListPage.spec.tsx` (MSW): columns and status words; "(you)" on the own row; the status filter is in the URL and survives a reload; search resets to page 1 and its text is **not** in `location.href`; `q` longer than 100 characters is cut or refused client-side; pagination; loading, empty, no-results and error (request id) states; the query key starts with the active clinic id (a clinic switch shows the other clinic's staff, never the previous list).
- `MemberDetailPage.spec.tsx`: fields; `joinedAt` in the clinic's zone (runner in New York); `404` → back to the list with the message.
- `RolesReference` spec: role names with their permission descriptions.

### M2: Staff changes (5.2)

- `member-actions.spec.ts`: every row of the 5.2 table, including precedence (own row that is also an owner; removed owner; suspended member seen by a non-owner).
- `MemberDetailPage.spec.tsx` (MSW): the buttons per case; Edit sends only changed fields, exactly `{ roleIds }`, `{ jobTitle }` or both; 0 and 6 roles are refused before sending; an emptied job title sends `null`; a non-assignable role shows its reason; each confirmation names the person and consequence and focuses Cancel; `204` refetches; each error code in the 5.2 table shows its text and refetches where stated; `VALIDATION_FAILED` details land on the fields with input kept.

### M3: Invitations (5.3)

- `invitation-actions.spec.ts`: buttons per status.
- `InvitationsPage.spec.tsx`: status filter in the URL (default Pending); columns and dates in the clinic's zone; Invite is hidden without `members.invite`; the role list never contains Owner; the request body is exactly `{ email, roleId }`; `201` reloads Pending; `CONFLICT`, `CONFLICT_UNIQUE`, `ROLE_NOT_ASSIGNABLE`, `VALIDATION_FAILED` on the right fields; Resend and Revoke success, confirmation, and `CONFLICT` reload.
- e2e mail fixture: `findEmailLink` spec-tested indirectly by the e2e below.

### M4: Account profile and email (5.4)

- `profile-name-form.spec.tsx`: blank and 121 characters refused; trimmed value sent; `200` updates the session name (the user menu shows it).
- `change-email-form.spec.tsx`: `PASSWORD_INCORRECT` on the password field; the same `202` message whether or not the address is free (one MSW handler answers 202 for both, and the text does not vary); `429` wait message; "Use a different address" resets the form.
- `verify-email-form.spec.tsx` and `routes.spec.tsx`: the token is removed from the address bar before the request; `204` ends the local session, tells other tabs and lands on sign-in with the `email-changed` notice; `TOKEN_INVALID`, `CONFLICT_UNIQUE`, `429` texts; the page opens when signed in and when signed out; no token in any URL afterwards.

### M5: Reacting to changes (5.5)

- `query-client.spec.ts`: `TENANT_NOT_SELECTED` and `TENANT_ACCESS_DENIED` from a query and a mutation call `onClinicLost` once; other codes do not.
- `routes.spec.tsx`: after `onClinicLost` with `GET /me` now `activeTenantId: null`, the person is on `/select-clinic` with the notice naming the clinic; a removed membership is no longer listed; with no usable clinic, the empty state.
- Focus refetch: `GET /me` is requested when the window regains focus, at most once a minute.

### M6: Clinic profile and branches (5.6)

- `routes.spec.tsx`: every clinic role sees **Clinic** and opens `/clinic` and `/clinic/branches`; `/clinic` with no clinic chosen → `/select-clinic`; a receptionist (`tenant.read`, `branches.read` only) sees no Edit, Add or Deactivate and does see the read-only reason; `/clinic/branches/new` without `branches.manage` shows "You don't have access to this page" without a request.
- `contact-phone.spec.ts`: `+63 917-123-4567` and `+63 (917) 123.4567` become `+639171234567`; `09171234567` (no `+`), `+0…`, 6 and 16 digits are refused; empty means "no phone".
- `ClinicProfilePage.spec.tsx` (MSW): details and read-only reason; Edit sends exactly the changed fields; emptied email or phone sends `null`; no change sends nothing; a time-zone change asks first, Cancel sends nothing; `200` shows the returned values; a name change refetches `GET /me/memberships` and the switcher shows the new name; after a zone change a dated query refetches; `VALIDATION_FAILED` on the fields with input kept.
- `BranchesPage.spec.tsx`: filter in the URL (default Active) and surviving a reload; columns, "Clinic's ({zone})" for a null zone; pagination; empty, loading and error states; query key starts with the clinic id.
- `NewBranchPage.spec.tsx` / `BranchPage.spec.tsx`: blank and 121-character names refused before sending; empty optional fields left out on create and sent as `null` on edit; `CONFLICT_UNIQUE` on the name; `201` goes to the branch page; Deactivate confirmation names the branch and focuses Cancel; Reactivate; the branch list refetches after each change; `404` → the list with the message.
- `datetime` spec: `timeZoneOptions()` contains `Asia/Manila` and `UTC`; the new-clinic form still passes its specs with the shared list.

### M7: End-to-end (real API, after M1–M6)

`tests/e2e/staff.spec.ts` (chromium project, serial; never leaves the seeded Sunrise accounts changed). Each run uses unique addresses `e2e-<timestamp>-…@example.test`.

1. Owner opens Staff: the seeded owner and receptionist are listed; the owner's row says "(you)" and offers job-title edit only.
2. Owner invites a new address as Clinic Admin → Pending lists it; the invitation email's link (`findEmailLink`) opens `/accept-invitation`; the new person sets a name and password and signs in to Sunrise; the invitation moves to Accepted and they appear on Staff.
3. As that clinic admin: Staff is visible; the owner's row offers job-title edit only; the Owner role is not selectable on anyone; their own row offers job-title edit only.
4. Owner suspends the clinic admin; in the clinic admin's open browser the next action lands on the clinic picker with the notice; owner reactivates; the clinic admin selects the clinic again.
5. Owner changes the clinic admin's role to Receptionist; after their next action (or focus), Staff disappears from their navigation.
6. Invite and revoke: the revoked link answers "link no longer works" on `/accept-invitation`; resend makes the first link fail and the second work.
7. Owner removes the clinic admin (cleanup); they no longer see Sunrise in the picker.
8. Receptionist: no Staff item; `/staff` shows "You don't have access to this page"; a direct `GET /members` with their token answers `403` (security check).
9. Cross-clinic: a member id from another clinic (an e2e clinic created through the platform admin, as in `platform-admin.spec.ts`) opened at `/staff/<id>` while in Sunrise → "This person is not on your staff."; Sunrise's list never shows that clinic's people.
10. axe on every staff page at 1280 px and 360 px; no sideways scrolling.

`tests/e2e/account-email.spec.ts` (chromium, serial), using a person created by invitation as above, never a seeded account:

1. Rename → the user menu shows the new name; reload keeps it.
2. Change email: wrong password → field error; right password → the neutral message; the link from the new address's email (`findEmailLink`) opens `/verify-email` → sign-in page with the notice; the old address is refused, the new one signs in.
3. The used link opened again → the invalid-link message.

`tests/e2e/clinic-settings.spec.ts` (chromium, serial; **built in 5.6**, 9 specs). Changes are made in an **e2e clinic created through the platform admin** (as in `platform-admin.spec.ts`), never in Sunrise, whose owner is only read from:

1. Receptionist in Sunrise: **Clinic** is visible; profile and branches ("Main", "Quezon City Annex") are read-only with the reason; `/clinic/branches/new` shows "You don't have access to this page"; a direct `PATCH /tenant` with their token answers `403` (security check).
2. The e2e clinic's owner (account set up from the email link, as in Phase 4): edits the contact email and phone; reload keeps them; changes the clinic name, and the clinic switcher shows the new name without a reload.
3. Changes the time zone (confirmation shown); a date on the Staff list shows in the new zone.
4. Adds a branch; adding a second with the same name shows the name error; edits its city; deactivates it (it leaves the Active filter and shows under Inactive); reactivates it.
5. Cross-clinic: the e2e clinic's branch id opened in Sunrise as Sunrise's owner → "This branch is not in your clinic."
6. axe on every clinic page at 1280 px and 360 px; no sideways scrolling.

Removed e2e members and their accounts accumulate in the dev database (no delete endpoint); their emails start with `e2e-`. So do the e2e clinics and their branches.

## 9. Acceptance criteria

- Every milestone's specs pass (New York and Manila runs), plus lint, format check, typecheck, `tokens:check`, `api:check`, `i18n:check`, build. Each new route chunk stays under 100 kB gzip; startup JavaScript does not grow because of these screens (lazy routes).
- The M7 e2e passes against the real API (Chromium; Firefox and WebKit in Docker).
- A doctor, nurse or receptionist never sees the Staff screens, and sees the Clinic pages read-only; no screen offers an action the API's owner, self or permission rules would refuse.
- `plan.md` (§0, §3, §5.2, §5.5, §10), this plan's "As Built", `AGENTS.md` (if a new pattern is introduced) and `docs/environment.md` (only if setup changes) match the code.

## 10. Accessibility and UX notes

- One primary action per screen: Invite on Invitations; on a member page the most likely safe action (Reactivate for a suspended member, otherwise Edit); Edit details on the profile; Add branch on Branches; on a branch page Reactivate for an inactive branch, otherwise Edit.
- Destructive confirmations name the person and the consequence; Cancel gets the initial focus.
- The role checkboxes have a visible legend and the 1–5 rule as a hint; errors stay on the page until dismissed.
- Tables reflow at 320 px (a table may scroll in its own box only); 200% zoom and keyboard-only checked by hand.

## 11. Open questions

Decided by the product owner (2026-11-23):

- **Q22: Clinic profile and branches** → sub-phase **5.6** of this plan (§5.6, M6).
- **Q23: A seeded clinic admin and doctor** → **yes**, added to the backend's dev seed (plan.md D-32, done 2026-11-23). Manual checks use them; the e2e still invites its own.
- **Q24: The signed-in person's own row on the Staff list** → **shown, marked "(you)"** (their job title is edited there).

Still open: none for this phase.

## As Built

### 5.1 Staff tab: read-only (2026-11-23)

Built as planned (screens, texts and rules of §5.1, tests of M1), with these differences, which the plan body above already describes:

- **The gate is a component, not a guard function.** `RequirePermission` (`src/app/RequirePermission.tsx`) wraps the `Outlet` in the layout route `src/routes/_app/_clinic/staff.tsx`. A guard function in `guards.ts` can only redirect or throw, and the plan wants a page that says "You don't have access to this page" at the same address. `/staff` and `/staff/$membershipId` both sit under it, so a typed address never asks the server for staff (spec: `routes.spec.tsx`, "staff pages").
- **No tab bar yet.** There is one tab until Invitations (5.3), so `StaffTabs` is built with 5.3. The Staff list has the "What each role can do" panel instead.
- **A missing person comes back through the address.** The detail page's `404` navigates to `/staff?notice=missing`; the list shows "This person is not on your staff." with a Close button. `notice` is the one extra value the address keeps (it holds no personal data).
- **Clinic switch safety.** `useActiveTenantId()` (`src/api/session/session-store.ts`) feeds every key. The list keeps the previous page on screen while the next loads, but only within the same clinic (spec: "never shows one clinic's staff while another clinic loads").
- **Dates.** `Joined` shows the date in the clinic's zone (`GET /tenant`, `[tenantId, 'tenant']`); until the zone is known the cell stays empty (never the computer's zone), and a note under the table says "Dates are shown in {zone}."
- **Search** text is cut to 100 characters (the API's limit) and stays in memory; the status and page are in the address.
- **A defect found and fixed on the way:** `createQueryClient` retried every failed read three times, so a `404` took about seven seconds to reach `onMissing`. It now does not retry `4xx` answers and retries other failures twice (`query-client.spec.ts`, "retrying a read"). This also speeds up the Phase 4 detail pages.
- **Test accounts.** The backend's seed now has `clinic-admin@sunrise.test` and `doctor@sunrise.test` (D-32). Checked on 2026-11-23 against a second API instance: the owner and the clinic admin hold `members.read` and `members.manage` and get `200` from `/members`, `/roles`, `/permissions`, `/tenant`; the doctor gets `403` from the first three and `200` from `/tenant`.

Verified (2026-11-23): 83 Vitest files, 1103 specs pass (New York), and the Manila date pass (67 specs); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass; `tests/e2e/staff.spec.ts` (7 specs, Chromium, real API: owner list, filter and search, detail, roles panel, missing person, 360 px, receptionist "no access") passes with axe and CSP checks. The staff chunks are small (the route chunks are 0.3 to 2.3 kB gzip).

Not verified or not done: the startup JavaScript is **195.7 kB** gzip (was 192.0 before 5.1; the budget is 170 kB, already exceeded; the cause of the 3.7 kB growth was not measured; the staff routes themselves are lazy chunks), Firefox and WebKit e2e (need Docker), manual screen-reader and 200% zoom checks, and a clinic with more than one page of staff against the real API (only the mocked specs cover paging).

### 5.2 Staff tab: changes (2026-11-23)

Built as planned (the rules table, the confirmations, the error table, tests of M2), with these differences, which the plan body above already describes or which are recorded here:

- **Files:** `members/member-actions.ts` (the rules, a pure function), `members/member-errors.ts` (the member-specific words for `SELF_ACTION_FORBIDDEN`, `OWNER_REQUIRED`, `LAST_OWNER`, `CONFLICT`), `members/EditMemberForm.tsx`, and `useUpdateMember` / `useSetMemberStatus` in `api/members.ts`. `MemberDetailPage` now also reads `GET /roles` before it shows anything (whether you are an owner comes from it, P5-3).
- **"Is the viewer an owner"** is the `owner` role's `assignable` flag from `GET /roles`; "is the target an owner" is the member's roles; "is it me" is the session user id.
- **Without `members.manage`** the page shows no buttons and the note "Only people who manage staff can change this." (the plan did not say).
- **A role you may not give** is not a disabled checkbox: it is left out of the list and a sentence under it says "Only an owner can give the Owner role." The hand-over hint ("To hand over the clinic, give another member the Owner role; they can then remove it from you.") is part of the Roles hint and appears only when the Owner role can be given.
- **Reactivate also asks first** (as the plan says), though the guide only requires it for Suspend and Remove.
- **The "bring them back" note for a removed member has no link yet:** the Invitations page does not exist before 5.3, which adds the link.
- **After a change** the person, the list and (on any failure) the roles are read again; a successful edit shows the answer of the `PATCH` at once. Confirmations are toasts ("Details saved.", "{name} is suspended.", "{name} can use the clinic again.", "{name} was removed."). "Nothing to change." is shown, and nothing is sent, when the form is saved unchanged.
- **A defect found by the real-API run and fixed:** after "Choose at least one role." the form would not submit even after a role was ticked (a field error set by hand blocks `handleSubmit`, and the role group is not a registered input). Choosing a role now clears that error and its line in the summary (`EditMemberForm.spec.tsx`, "lets the person fix \"no roles\" and save").

Verified (2026-11-23): 84 Vitest files, 1147 specs pass (New York) and the Manila date pass (67); lint, format check, typecheck, `api:check` and `build` pass; `tests/e2e/staff.spec.ts` now has 15 specs on Chromium against the real API and all pass: job title edit and restore, role change with the "no roles" refusal and restore (restored even when an assertion fails), suspend and reactivate each after a confirmation, Remove asking first and Cancel changing nothing, the owner's own row, and the clinic admin's limits on the owner's row, on their own row and on the Owner role. The seeded accounts end as the seed made them (the e2e puts the doctor back).

Not verified or not done: the real API's `OWNER_REQUIRED`, `LAST_OWNER` and `CONFLICT` answers (only mocked; the owner-gives-Owner-role hand-over is not in the e2e because it would change the seeded owner), the six-roles refusal in a browser (a spec covers it), Firefox and WebKit (need Docker), manual screen-reader and 200% zoom checks. The startup JavaScript is 196.3 kB gzip (budget 170 kB, already exceeded; 195.7 before 5.2).

### 5.3 Invitations (2026-11-24)

Built as planned (the status table, the invite dialog, resend and revoke, the error texts, tests of M3), with these differences, which the plan body above already describes or which are recorded here:

- **Files:** `StaffTabs.tsx` (a `nav` named "Staff sections" with two links; also shown on the Staff list), `invitations/InvitationsPage.tsx`, `InviteDialog.tsx`, `InvitationStatusPill.tsx`, `invitation-actions.ts`, `api/invitations.ts`, and the route `staff/invitations.tsx` (a static path, so it wins over `$membershipId`).
- **The page's heading is "Invitations"** (the Staff list keeps "Staff"); Invite someone is the primary action beside it.
- **Pending is the default and stays out of the address;** the other statuses, the page and its size are in it. The request always carries an explicit `status`.
- **Row buttons keep the visible words "Resend" and "Revoke"** and carry the person in their accessible name ("Resend invitation to {email}"), since a table repeats them.
- **Without `members.invite`** the list is shown with no buttons and the note "Only people who can invite staff can send, resend or revoke invitations."
- **After an invitation is sent** the dialog closes and the list switches to Pending, from whatever filter it was on. "Show open invitations" (offered after `CONFLICT_UNIQUE`) does the same.
- **The dialog is mounted only while open,** so each opening starts empty, and it asks before closing with unsaved input. It checks every field on each Send itself (not through the form library's rules), because a leftover error on the role group, which is not a registered input, otherwise stopped the form from submitting at all.
- **The removed-member note** on the member page now links to Invitations ("Go to Invitations").
- **Resend does not ask first** (as the plan says); Revoke does, with Cancel focused.

Verified (2026-11-24): 87 Vitest files, 1189 specs pass (New York) and the Manila date pass (67); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass; `tests/e2e/staff.spec.ts` has 16 specs on Chromium against the real API and all pass, including the server's `CONFLICT` ("already on your staff") and `CONFLICT_UNIQUE` ("already open") answers, send again, revoke after a confirmation, and the Revoked filter. The route chunk is 4.0 kB gzip. Each run leaves one revoked `e2e-…@example.test` invitation (invitations cannot be deleted).

Not verified or not done: opening the emailed link and accepting (M7 does it with `findEmailLink`), that the old link stops working after Resend or Revoke (server behavior, not exercised in a browser), an **Expired** or **Accepted** row against the real API (none can be created without waiting or accepting), Firefox and WebKit (need Docker), manual screen-reader and 200% zoom checks. The startup JavaScript is 198.9 kB gzip (budget 170 kB, already exceeded; 196.3 before 5.3).

### 5.4 Account: profile and email (2026-11-24)

Built as planned (the name form, the change-email form and its neutral message, the public confirmation page, the tests of M4), with these differences, which the plan body above already describes or which are recorded here:

- **Files:** `account/profile-name-form.tsx`, `account/change-email-form.tsx`, `auth/verify-email-form.tsx`, `VerifyEmailPage` in `auth/auth-pages.tsx`, the route `src/routes/verify-email.tsx`, `updateSignedInUser()` in `api/session/session-store.ts`, and the notice `email-changed` (session notice, sign-in page text, and the `?notice=` list). The e2e mail fixture is now `findEmailLink({ to, path })`; `findSetupLink` calls it.
- **The confirmation page asks for a button press** instead of posting on load (see the plan body). The page opens signed in or out, takes the token from the fragment into memory, and on success calls `endSession('email-changed')` (no request: the server already ended every session) and goes to `/login?notice=email-changed`.
- **The password field of the change-email form is labelled "Your password"** (not "Current password"), so it is not confused with the field of the same name in the change-password form on the same page.
- **A new email equal to the current one** (ignoring case) is refused in the form ("That is already your email address."), since the server would answer `202` and no link would ever arrive.
- **A wrong password is cleared** from its field after `PASSWORD_INCORRECT`, and the typed address is kept.
- **The page layout** is four sections: Your details (email, clinic, role; read-only), Your name, Change email, Change password. The old sentence "ask your clinic admin" is gone.
- **The name change reaches only this tab's session.** Other open tabs show the old name until they reload (no broadcast was added).

Verified (2026-11-24): 90 Vitest files, 1225 specs pass (New York) and the Manila date pass (67); lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass; `tests/e2e/account-email.spec.ts` (4 specs, Chromium, real API with `MAIL_TRANSPORT=file`) passes end to end: the owner invites a new person, who accepts from the emailed link and signs in; rename (the user menu changes at once, a reload keeps it); wrong password refused; the neutral message; the link from the new address confirms it; the old address is refused and the new one signs in; the used link is invalid. The staff e2e still passes (16). The route chunks are small (the account chunk grew to 2.6 kB gzip, `verify-email` is 0.9 kB).

Not verified or not done: a change to an address that is already taken (the server answers `202` and sends a notice instead, which a browser run cannot observe here), `CONFLICT_UNIQUE` on confirmation (only mocked), the old address's "your email changed" notice (a backend email, not read), other tabs after a rename (not broadcast), Firefox and WebKit (need Docker), manual screen-reader and 200% zoom checks. Running `staff.spec.ts` right after `account-email.spec.ts` once failed its last test; the same spec passed alone on a fresh API, and the likely cause is the API's limit of 30 page refreshes a minute per address (not confirmed). Each run leaves one new `e2e-acct-…@example.test` account (accounts cannot be deleted). The startup JavaScript is 200.6 kB gzip (budget 170 kB, already exceeded; 198.9 before 5.4).

### 5.5 Reacting to changes made to you (2026-11-24)

Built as planned (P5-13, the table of §5.5, the tests of M5), with these differences, which the plan body above already describes or which are recorded here:

- **Files:** `app/refresh-on-focus.ts` (+ spec), `onClinicLost` in `app/query-client.ts` (now a required option next to `onForbidden`), `lostClinicName` and the event `clinic-lost` in the session module, the `lostClinicName` prop and its warning alert in `auth/select-clinic.tsx`, wired in `app/App.tsx`.
- **`onClinicLost` calls `refreshPermissions()`**, the same reload as `onForbidden`; no new session method. The reload itself notices the loss: an active clinic that is now `null` means an admin took it away. The session then keeps `lostClinicName` (read from the memberships it already held) until a clinic is chosen, emits `clinic-lost` once (so `SessionSync` clears everything cached for that clinic), and the clinic guard sends the person to `/select-clinic`. Choosing a clinic drops the name.
- **The notice is a warning alert on the picker** ("You no longer have access to {clinic}."), above the list or the empty state. It lives in the session state, not in the address, so a clinic name is never put in a URL.
- **The picker's list did not change.** The API already leaves removed memberships out of `GET /me/memberships` and clears the active clinic of a person who is suspended or removed (`SessionService.clearActiveTenant`), so "no longer lists a removed one" needed no code. The picker's existing wording for a removed clinic stays as a harmless fallback.
- **Focus refetch:** on `focus` and when the tab becomes visible again, `GET /me` and `GET /me/memberships` are read again (through `refreshPermissions`), at most once a minute, only while signed in. A failure other than a sign-out is ignored and the old permissions stay.
- **Many failed requests at once** each call `onClinicLost`; the reload is idempotent (the name is kept, the event is sent only on the first one), so no extra single-flight was added.

Verified (2026-11-24): 91 Vitest files, 1248 specs pass; lint, format check and typecheck pass; `i18n:extract` added one message ("You no longer have access to {lostClinicName}.") to both catalogs.

Not verified or not done: the flow against the real API in a browser (suspend or remove the signed-in person from another session and watch the page; M7 covers it, not written yet), Firefox and WebKit, manual screen-reader and zoom checks, the bundle size (`npm run size` and the Playwright suites were not run for 5.5; the change adds one small module and one alert).

### 5.6 Clinic profile and branches (2026-11-24)

Built as planned (P5-14 to P5-19, the screens of §5.6, the tests of M6 and the e2e of M7 for this sub-phase), with these differences, which the plan body above already describes or which are recorded here:

- **Files:** `clinic/api/tenant.ts`, `clinic/api/branches.ts`, `clinic/ClinicTabs.tsx`, `clinic/profile/` (`ClinicProfilePage`, `ClinicProfileForm`, `contact-phone.ts`), `clinic/branches/` (`BranchesPage`, `NewBranchPage`, `BranchPage`, `BranchForm`, `BranchStatusPill`), the routes under `routes/_app/_clinic/clinic*`, the **Clinic** item in the shell (hospital icon, `requires: 'tenant.read'`, current for every path under `/clinic`), and `timeZoneOptions()` in `lib/datetime` (also used by `NewClinicForm` now).
- **`useClinicProfile` moved** to `features/clinic/api/tenant.ts` with the same query key (`[tenantId, 'tenant']`) and cache time; `useClinicTimeZone` (Staff dates) now reads from it, so Staff and Clinic share one cached `GET /tenant`.
- **`BranchForm` is shared by "add" and "edit".** It checks the lengths and the required name, then hands trimmed values to the page, which builds the request (create: empty optional fields left out and `isActive: true` sent, because the contract marks it required; edit: only the changes, `null` for an emptied field or to go back to the clinic's zone). `CONFLICT_UNIQUE` is shown on the name by the form. The branch time-zone picker's first choice is "Clinic's time zone ({zone})" (empty).
- **Time-zone confirmation** is a `ConfirmDialog` with the title "Change the time zone?" and the button "Change time zone"; it names the clinic's new name when the name changed in the same save.
- **Reused:** `ClinicStatusPill` (Phase 4) for the clinic's status in words; `AppButtonLink` for "Add branch".
- **`DetailRow`** (`design-system/patterns/detail-row.tsx`) replaces three identical private `Detail` helpers (`ClinicDetailPage`, `UserDetailPage`, `MemberDetailPage`) and is used by the two new pages. `AccountPage` keeps its own, whose label column is narrower.
- **A new clinic starts with one branch, "Main"**, with no time zone of its own (seen in the e2e: the platform admin creates the clinic and its owner's branch list already has it). The e2e expects it.
- **Name change:** the page calls `refreshPermissions()` after a save that changed the name, so the switcher and the picker show it without a reload (P5-17); the e2e checks the top bar.
- **Not offered:** deleting a branch, staff-to-branch assignment, and a phone number on a person (not in the API).

Verified (2026-11-24): 96 Vitest files, 1330 specs pass in New York and in Manila time (`TEST_TZ=Asia/Manila`); lint, format check, typecheck, `api:check`, `tokens:check`, `build` pass; `tests/e2e/clinic-settings.spec.ts` (9 specs, Chromium, a second API instance with `MAIL_TRANSPORT=file` and the preview origin) passes end to end: a platform admin creates a clinic and its owner sets up and signs in; the seeded receptionist reads the profile and branches with the reasons, `/clinic/branches/new` shows "no access" and a direct `PATCH /tenant` answers `403`; the new owner edits the contact details (bad phone refused, reload keeps the values), renames the clinic (the top bar changes without a reload), changes the time zone after the confirmation (the Staff list says "Dates are shown in Asia/Tokyo."), adds a branch (duplicate name refused), edits its city, deactivates it (it leaves Active and shows under Inactive) and reactivates it; Sunrise's owner opening that branch's address is sent back to the list with "This branch is not in your clinic."; axe and no sideways scrolling on the four clinic pages at 1280 px and 360 px. `account-email.spec.ts` and `smoke.spec.ts` still pass. The 5.6 screens add no startup JavaScript that could be measured (206.1 kB gzip with and without the Clinic navigation item; budget 170 kB, already exceeded; 200.6 kB at 5.4); the new route chunks are 0.1 to 2.5 kB each.

Not verified or not done: Firefox, WebKit and the phone project (the spec runs on Chromium only; the 360 px check uses a Chromium window), manual screen-reader and 200% zoom checks, the Manila-zoned date of a branch in a zone different from the clinic's (a branch with its own zone shows the zone's name, no dates), and the dependence of two e2e specs on the exact seeded data, found on 2026-11-24 after manual testing had changed the dev database (the original receptionist's email became `receptionist@sunrise.test`, a re-seed then added a second "Rhea Receptionist", and Sunrise's "Main" branch was renamed "Main branch"): `staff.spec.ts` now opens the receptionist by the **email in the row** (not the name) and `clinic-settings.spec.ts` matches the seeded branch by the start of its name (`/^Main/`). Both then passed again (16 and 9 specs).

Remaining for Phase 5: the M7 items of 5.1 to 5.5 still marked "not done" above (see the review below), and the Firefox and WebKit runs (Docker).

### Review of 5.1 to 5.6 (2026-11-24)

Checked from scratch after 5.5 and 5.6 were built in another session: lint, format check, typecheck, `api:check`, `tokens:check` and `build` pass; 96 Vitest files, 1330 specs pass in New York time and the Manila date pass (69); against a fresh API with `MAIL_TRANSPORT=file`, each Chromium e2e spec passes when run on its own: `staff` (16), `account-email` (4), `clinic-settings` (9), `smoke` (4) and the Phase 4 `platform-admin` (12). The API allows 5 sign-ins per 15 minutes per account and 30 refreshes a minute per address, so several runs in a row against one API instance make a later sign-in fail (it did, for the receptionist, until the API was restarted).

**M7 items not covered by any e2e yet:** the invitation acceptance chain for a clinic admin, and the admin's limits seen as that new person (items 2, 3); **suspension, role change and removal seen in the affected person's open browser** (items 4, 5, 7: the notice on the picker, Staff disappearing, the focus refetch), which is the only real-API check of 5.5; the old and new invitation link after Resend and Revoke (item 6); a member id from another clinic opened in Sunrise (item 9); and the 360 px and axe pass on the invitations page. 5.5 is therefore verified by unit specs only.

Startup JavaScript: 206.1 kB gzip against the 170 kB budget (200.6 kB at 5.4); the budget decision is still open.

### Fix: the time zone's error link (2026-11-26)

On the branch form and the clinic profile form, the error summary's **Time zone** link did not move focus: the `Combobox` had no `name`. Both have `name="timezone"` now (`NewBranchPage.spec.tsx`, `ClinicProfilePage.spec.tsx`). A refused time zone is still explained in the summary only, not under the field.
