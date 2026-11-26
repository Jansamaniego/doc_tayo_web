# Staff management and account screens: frontend integration guide (Phase 4)

For the people (or AI agent) building the DocTayo web app. This guide covers every Phase 4 endpoint **except** the platform-admin ones (`/admin/*`, in [platform-admin-integration.md](platform-admin-integration.md)). Read [frontend-integration.md](frontend-integration.md) first for sign-in, tokens, clinic selection, errors and conventions. The exact shapes are in [openapi.json](openapi.json) (tags `members`, `invitations`, `roles`, `me`).

The work is split into five sub-phases. Do them in order: each one builds on the previous one, and 4.1–4.3 are the owner and clinic-admin screens.

| Sub-phase | Who uses it | What it adds |
|---|---|---|
| [4.1 Staff tab: read-only](#41-staff-tab-read-only) | Owner, clinic admin | Staff list, search, filters, member detail, roles reference |
| [4.2 Staff tab: changes](#42-staff-tab-changes) | Owner, clinic admin | Edit roles and job title; suspend, reactivate, remove |
| [4.3 Invitations](#43-invitations) | Owner, clinic admin | Invitation list, invite, resend, revoke |
| [4.4 Account: profile and email](#44-account-profile-and-email) | Every signed-in user | Edit name, change email, the `/verify-email` page |
| [4.5 Reacting to changes made to you](#45-reacting-to-changes-made-to-you) | Every clinic user | What the app does when an admin changes your roles or status |

**Test accounts** (after `npm run db:seed:dev`; password `dev-password-change-me-123`): `owner@sunrise.test` (owner), `clinic-admin@sunrise.test` (clinic admin: sees the owner-only limits), `doctor@sunrise.test` and `reception@sunrise.test` (for checking that the Staff tab stays hidden). Running the seed again puts these four back to active with their original role, so it also undoes test changes to them.

## Who sees what

Decide from `GET /me` → `permissions` (the active clinic only), never from role names:

| Permission | Held by default by | Unlocks |
|---|---|---|
| `members.read` | owner, clinic admin | Staff tab, Invitations list, `GET /roles`, `GET /permissions` |
| `members.manage` | owner, clinic admin | Edit, suspend, reactivate and remove members |
| `members.invite` | owner, clinic admin | Invite, resend and revoke invitations |

Doctors, nurses and receptionists hold none of them: hide the Staff tab for them. The staff directory for clinical screens is `GET /directory` ([clinical-integration.md](clinical-integration.md)).

**Owner vs clinic admin.** Both have the same permissions. The difference is one rule on top: only an **owner** may give or take the Owner role, or suspend, reactivate or remove someone who holds it. To know whether the signed-in user is an owner in the active clinic, find the entry in `GET /me/memberships` whose `tenantId` equals `activeTenantId`, and check `roles` for `key === 'owner'`. (`GET /roles` gives the same answer: the `owner` role has `assignable: true` only for owners.)

---

## 4.1 Staff tab: read-only

| Screen or action | Call | Notes |
|---|---|---|
| Staff list | `GET /members?page=&pageSize=&q=&status=` | Sorted by full name. Without `status`, every member **except** removed ones. `status`: `active`, `suspended`, `removed` (`invited` exists in the schema but the API never creates it today: people who have not joined yet are in Invitations). `q`: part of the name or email, case-insensitive, at most 100 characters. |
| Member detail | `GET /members/:membershipId` | Same fields as a list item. Unknown id, or another clinic's: `404 NOT_FOUND`. |
| Roles reference | `GET /roles` | The clinic's roles: `id`, `key`, `name`, `isSystem`, `permissions` (keys), `assignable` (whether **you** may give it). System roles first, then by name. |
| Permission descriptions | `GET /permissions` | `key`, `description`, sorted by key. Use it to explain what each role can do. |

A member item: `membershipId`, `userId`, `email`, `fullName`, `status`, `jobTitle` (or `null`), `roles: [{ id, key, name }]`, `joinedAt` (or `null`).

- **Ids:** `membershipId` is the person's place in **this** clinic and is what every `/members/:membershipId` call takes. `userId` is their account across clinics. Use `userId === me.id` to find the signed-in user's own row.
- **Suggested filter tabs:** All (no `status`), Active, Suspended, Removed.
- Lists are paginated: `page` (from 1), `pageSize` (default 20, at most 100), response `meta: { page, pageSize, totalItems, totalPages }`.

**Done when:** an owner and a clinic admin see the list, search it, filter by status and open a member; a receptionist does not see the tab (and gets `403 FORBIDDEN` if the URL is typed in).

---

## 4.2 Staff tab: changes

| Action | Call | Result |
|---|---|---|
| Edit roles and/or job title | `PATCH /members/:membershipId` `{ roleIds?, jobTitle? }` | `200` with the updated member. Send only the fields that changed; an empty body changes nothing. |
| Suspend | `POST /members/:membershipId/suspend` | `204`. From `active` only. |
| Reactivate | `POST /members/:membershipId/reactivate` | `204`. From `suspended` only. |
| Remove | `POST /members/:membershipId/remove` | `204`. From `active` or `suspended`. |

**Form rules** (`400 VALIDATION_FAILED` with per-field `details` otherwise):

- `roleIds` **replaces** the member's roles: send the whole set, 1 to 5 distinct ids from `GET /roles`. Offer as selectable only roles with `assignable: true`. An unknown role id: `404 NOT_FOUND`.
- `jobTitle`: at most 100 characters, trimmed; `null` clears it.

### Which buttons to show on a row

Work through these in order; the first match decides.

| The row is | Show |
|---|---|
| Your own row (`userId === me.id`) | Edit **job title** only. No role edit, no status buttons (the API answers `403 SELF_ACTION_FORBIDDEN`: another admin must do it). |
| `removed` | Nothing. To bring them back, invite them again (4.3). |
| Holds `owner`, and you are **not** an owner | Edit **job title** only; explain "Only an owner can change an owner's roles or status" (otherwise `403 OWNER_REQUIRED`). |
| `active` | Edit (roles and job title), Suspend, Remove |
| `suspended` | Edit (roles and job title), Reactivate, Remove |

Ask for confirmation before Suspend and Remove, and say what happens:

- **Suspend:** they lose access to this clinic on their next request. Their account, sign-in and other clinics are untouched. Reversible with Reactivate.
- **Remove:** same loss of access; the row is kept for history and shown under the Removed filter. It cannot be undone here: coming back is by a new invitation, which can give a different role.

After any change, reload the row (or use the `PATCH` response). Changes apply to the member on their next request; nothing is pushed to them.

### Errors on this screen

| `error.code` | HTTP | Meaning and what to do |
|---|---|---|
| `SELF_ACTION_FORBIDDEN` | 403 | Your own membership. Should not happen if the own row is handled as above. |
| `OWNER_REQUIRED` | 403 | A non-owner tried to give or take the Owner role, or to change an owner's status. |
| `LAST_OWNER` | 409 | The change would leave the clinic with no active owner. Only reachable when two owners act at the same moment. Reload and show the message. |
| `CONFLICT` | 409 | Not allowed from the current status (someone changed it first), or too many simultaneous changes. Reload the row and show the message. |
| `NOT_FOUND` | 404 | The member (or a role id) is not in this clinic. Go back to the list. |
| `FORBIDDEN` | 403 | You lost `members.manage`. Refetch `GET /me` and hide the actions. |

**Owner hand-over:** there is no separate flow. An owner gives the Owner role to another member (edit roles), and then the new owner may take it away from the old one (an owner cannot change their own roles).

**Done when:** an owner can change a clinic admin's roles, suspend, reactivate and remove them; a clinic admin can do the same to a doctor but sees only job-title edit on the owner's row and on their own row; each error above shows a sensible message.

---

## 4.3 Invitations

People are added to a clinic only by invitation: an email with a link valid for 7 days. The acceptance page (`/accept-invitation#token=…`) belongs to the authentication work and is described in [frontend-integration.md](frontend-integration.md) section 7. Invite and resend existed before Phase 4, so they may already be built; list and revoke are new.

| Screen or action | Call | Notes |
|---|---|---|
| List | `GET /invitations?status=&page=&pageSize=` | `status`: `pending` (the default), `accepted`, `revoked`, `expired`. Newest first. Each item: `id`, `email`, `roleId`, `role: { id, key, name }`, `invitedBy: { membershipId, fullName }`, `status`, `expiresAt`, `createdAt`, `acceptedAt`, `revokedAt`. Needs `members.read`. |
| Invite | `POST /invitations` `{ email, roleId }` | `201` with `id`, `email`, `roleId`, `status`, `expiresAt`, `createdAt`. Then reload the list. |
| Resend | `POST /invitations/:invitationId/resend` | `200`. A new link with a fresh 7 days; **the old link stops working**. Allowed for pending and expired invitations. |
| Revoke | `POST /invitations/:invitationId/revoke` | `204`. The link stops working. Allowed for pending and expired invitations (revoking an expired one frees the address for a new invitation). |

**Invite form:**

- `email`: a valid address, at most 254 characters (lower-cased by the server).
- `roleId`: from `GET /roles`, **never the Owner role** (leave it out of the picker; the API answers `422 ROLE_NOT_ASSIGNABLE`). The Owner role is given afterwards through 4.2.
- The person may already have a DocTayo account (another clinic): that is fine, they accept with the link and their existing password.

**Buttons per status:**

| Status | Buttons |
|---|---|
| `pending` | Resend, Revoke |
| `expired` | Resend, Revoke |
| `accepted`, `revoked` | none |

**Errors:**

| `error.code` | HTTP | Show |
|---|---|---|
| `CONFLICT` | 409 | On invite: "This person is already a member of the clinic." On resend or revoke: already accepted or revoked; reload the list. |
| `CONFLICT_UNIQUE` | 409 | On invite: "An invitation to this address is already open." Offer to resend it from the list. |
| `ROLE_NOT_ASSIGNABLE` | 422 | The Owner role was chosen. |
| `NOT_FOUND` | 404 | The role or invitation is not in this clinic. |
| `VALIDATION_FAILED` | 400 | Show each `details[]` item under its field. |

A **removed** member can be invited again; accepting brings the same membership back with the invited role.

**Done when:** an owner invites a clinic admin, the invitation appears under Pending, resend and revoke work (the old link then fails with `TOKEN_INVALID`), and the accepted invitation moves to Accepted while the person appears in the Staff list.

---

## 4.4 Account: profile and email

For every signed-in user, with or without a selected clinic.

| Screen or action | Call | Notes |
|---|---|---|
| Profile | `GET /me` | `id`, `email`, `fullName`, `emailVerifiedAt`, `passwordChangedAt`, `platformRole`, `activeTenantId`, `permissions`. |
| Edit name | `PATCH /me` `{ fullName }` | `200` with the `GET /me` shape. `fullName` is required, trimmed, 1–120 characters. Nothing else can be edited (no phone yet, `TODO-LATER L-01`). |
| Change email | `POST /me/email` `{ newEmail, currentPassword }` | See below. |
| Confirm the new email | page `/verify-email#token=…` → `POST /auth/email/verify` `{ token }` | See below. |

**Change email, step 1 (signed in):**

- A wrong current password answers `400 VALIDATION_FAILED` with `PASSWORD_INCORRECT` on `currentPassword`.
- Otherwise the answer is **always** `202 { data: { accepted: true } }`, whether or not the address is free (the API never reveals which addresses are taken). Say "If the address can be used, we sent a link to it. Open it within 30 minutes." The email does **not** change yet.
- At most 5 attempts per 15 minutes per user (`429 RATE_LIMITED`, read `Retry-After`).

**Change email, step 2 (the `/verify-email` page, public):**

1. Read the token from the URL fragment (`#token=…`), then remove it from the address bar (`history.replaceState`).
2. `POST /auth/email/verify` `{ token }`.
3. `204`: the email is changed and **every session of the user ends**, including this one. Clear the in-memory token and show "Your email was changed. Sign in with your new address." The old address gets a notice.
4. `400 TOKEN_INVALID`: the link is used, expired (30 minutes), or replaced by a newer request (only the newest link works). Offer to start again from the profile.
5. `409 CONFLICT_UNIQUE`: someone took the address in the meantime. Nothing changed.
6. `429 RATE_LIMITED`: too many attempts; show a wait message.

**Done when:** a user renames themselves and sees the new name everywhere; a user changes their email end to end and can sign in only with the new address.

---

## 4.5 Reacting to changes made to you

When an admin changes **your** membership, nothing is pushed to your browser. Your next request tells you:

| What the admin did | What your next request answers | What the app does |
|---|---|---|
| Changed your roles | Clinic calls now pass or fail by the new permissions; a lost one answers `403 FORBIDDEN`. | On `403 FORBIDDEN`, refetch `GET /me` and rebuild menus from `permissions`. Refetching `GET /me` when the app regains focus also keeps menus current. |
| Suspended or removed you | `403 TENANT_NOT_SELECTED` (the API unselects the clinic on your sessions), or `403 TENANT_ACCESS_DENIED` for a request already in flight. | Refetch `GET /me/memberships` and show the clinic picker. The clinic is listed with `membershipStatus: "suspended"` (show it as unavailable); a removed one is not listed. If no clinic remains, show an empty state ("You are not an active member of any clinic"). |
| Reactivated you | Nothing until the clinic is selected again. | It is selectable again in the picker (`POST /auth/switch-tenant`). Signing in again also selects it automatically when it is the user's only active clinic. |

Your account and sign-in are untouched by all three: you stay signed in and keep your other clinics.

**Done when:** with two browsers (an owner and a doctor), suspending the doctor sends them to the picker on their next action, reactivating lets them select the clinic again, and a role change updates their menus after a refetch of `GET /me`.

---

## Not available in Phase 4

Do not build these: there is no endpoint.

- Creating custom roles or changing a role's permissions (`TODO-LATER L-04`).
- Leaving a clinic by yourself (`TODO-LATER L-03`).
- An admin sending a password-reset email for a member (`TODO-LATER L-02`). Members who never set a password: resend their invitation; a forgotten password: the member uses "Forgot password".
- Branch-restricted memberships (`TODO-LATER L-08`).
- A phone number on the profile (`TODO-LATER L-01`).
- An audit-log viewer (Phase 6).
