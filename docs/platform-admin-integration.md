# Platform-admin tabs: frontend integration guide

For the people (or AI agent) building the DocTayo web app. Platform administration is **not a separate portal**: it is a set of extra tabs in the same app, shown only to platform admins. This guide covers when to show them and what each one calls. Read [frontend-integration.md](frontend-integration.md) first for sign-in, tokens, errors and conventions; the exact shapes are in [openapi.json](openapi.json) (tag `admin`).

**Words:** the API says **tenant**, the UI says **clinic**. They are the same thing: `GET /admin/tenants` is the Clinics tab.

## 1. Who sees the tabs

`GET /me` returns `platformRole`: `"platform_admin"` or `"none"`.

```ts
const me = (await api.get('/me')).data;
const showAdminTabs = me.platformRole === 'platform_admin';
```

- Show the **Clinics** and **Users** tabs only when `platformRole === 'platform_admin'`. Hiding them is for convenience: the server refuses every `/admin/*` call from anyone else with `403 FORBIDDEN`.
- The role is read on every request. If it is taken away, the next `/admin/*` call answers `403 FORBIDDEN`: refetch `GET /me` and hide the tabs.
- The role is granted on the server only (`npm run admin:grant -- <email>`). There is no endpoint or screen for it.
- Development account: `admin@doctayo.test` / `dev-password-change-me-123` (after `npm run db:seed:dev`).

## 2. How the admin tabs sit beside the clinic tabs

The platform role and clinic access are independent:

| The user has | Show |
|---|---|
| `platformRole: "platform_admin"`, no memberships (the usual case) | Only Clinics and Users, plus the account screens (`/me`). Do **not** show the clinic picker or clinic tabs; land on Clinics. |
| `platformRole: "platform_admin"` and clinic memberships | Clinics and Users, **and** the normal clinic tabs driven by `permissions` and the clinic picker. |
| `platformRole: "none"` | The normal app only. |

- `/admin/*` calls **never need a selected clinic**: no `switch-tenant` first, and they never answer `TENANT_NOT_SELECTED`.
- The platform role grants **no** clinic data. A platform admin can select only clinics they are a member of (`switch-tenant` to any other answers `403 TENANT_ACCESS_DENIED`). The admin tabs show only what `/admin/*` returns.

## 3. Clinics tab

| Screen or action | Call | Notes |
|---|---|---|
| List | `GET /admin/tenants?page=&pageSize=&q=&status=` | `q` matches name or slug (case-insensitive). `status`: `active`, `suspended`, `deactivated`. Sorted by name. Each item: `id`, `name`, `slug`, `status`, `timezone`, `createdAt`, `memberCount` (active members). |
| Detail | `GET /admin/tenants/:tenantId` | The list fields plus `owners: [{ userId, fullName, email }]` (active owners). Unknown id: `404 NOT_FOUND`. |
| New clinic | `POST /admin/tenants` `{ name, slug, ownerEmail, ownerFullName, timezone? }` | `201` with the clinic. Creates the clinic, its standard roles, a branch named "Main" and the owner's membership. An owner who has not set a password yet (a new account, or an existing `pending` one) gets an account-setup email; anyone else gets a notice and keeps their password and other clinics. Slug taken: `409 CONFLICT_UNIQUE`; put it under the slug field. |
| Suspend | `PATCH /admin/tenants/:tenantId/status` `{ status: "suspended" }` | Only from `active`. `204`. Members get `403 TENANT_SUSPENDED` on their next request. |
| Reactivate | same, `{ status: "active" }` | Only from `suspended`. `204`. |
| Deactivate | same, `{ status: "deactivated" }` | From `active` or `suspended`. **One-way**: ask for confirmation and say it cannot be undone. Members get `403 TENANT_DEACTIVATED`. |

**Form rules** (`400 VALIDATION_FAILED` with per-field `details` otherwise):

- `name`: required, at most 120 characters.
- `slug`: at most 60 characters, lower-case letters and digits in groups separated by single hyphens (`bayview-clinic`). Suggest one from the name, but let the admin edit it.
- `ownerEmail`: a valid email.
- `ownerFullName`: required, at most 120 characters.
- `timezone`: an IANA name. It defaults to `Asia/Manila` when left out.

**Status buttons:** offer only the transitions that are allowed from the current status. A disallowed one answers `409 CONFLICT`, which can also happen when another admin changed the clinic first: reload it and show the message.

| Current status | Buttons |
|---|---|
| `active` | Suspend, Deactivate |
| `suspended` | Reactivate, Deactivate |
| `deactivated` | none |

## 4. Users tab

Users are accounts across the whole platform, not one clinic's staff.

| Screen or action | Call | Notes |
|---|---|---|
| List | `GET /admin/users?page=&pageSize=&q=&status=` | `q` matches name or email. `status`: `pending`, `active`, `deactivated`. Sorted by email. Each item: `id`, `email`, `fullName`, `status`, `platformRole`, `membershipCount` (memberships that are not removed). |
| Detail | `GET /admin/users/:userId` | Same fields. Unknown id: `404 NOT_FOUND`. |
| Deactivate | `PATCH /admin/users/:userId/status` `{ status: "deactivated" }` | Only from `active`. `204`. Signs the user out on every device and refuses sign-in. |
| Reactivate | same, `{ status: "active" }` | Only from `deactivated`. `204`. |

- **`pending`** means the person has not set a password yet (a new clinic owner or an invited person). There is no button for them: they activate through their own emailed link, and the API answers `409 CONFLICT`.
- **Your own row:** hide the status buttons. The API answers `403 SELF_ACTION_FORBIDDEN`.
- An already-applied status answers `409 CONFLICT`.

## 5. Lists and errors

- Pagination: `page` (from 1) and `pageSize` (default 20, at most 100). The response has `data` and `meta: { page, pageSize, totalItems, totalPages }`.
- Admin-specific errors:

| `error.code` | HTTP | Do this |
|---|---|---|
| `FORBIDDEN` | 403 | Not (or no longer) a platform admin: refetch `GET /me` and hide the tabs. |
| `SELF_ACTION_FORBIDDEN` | 403 | Your own account in Users. |
| `NOT_FOUND` | 404 | The clinic or user does not exist: go back to the list. |
| `CONFLICT` | 409 | Status change not allowed from the current status: reload the row. |
| `CONFLICT_UNIQUE` | 409 | New clinic: the slug is taken. |
| `VALIDATION_FAILED` | 400 | Show each `details[]` item under its field. |

Token expiry, `401` and `429` work as everywhere else ([frontend-integration.md](frontend-integration.md) sections 4 and 6).

## 6. Not available yet

Do not build these: there is no endpoint.

- Editing a clinic's name, contact details or time zone from the admin tabs (only the clinic's own owner can, through `PATCH /tenant`).
- Listing a clinic's staff, or changing someone's clinic roles, from the admin tabs.
- Granting or removing the platform role.
- Resending an account-setup link, or sending a password reset for someone.
- An audit-log viewer.
- Two-factor sign-in for platform admins (`TODO-LATER L-06`).
