# Phase 4: Account and clinic settings (outline)

Status: **outline**. Depends on Phase 3. Backend: **partly available**.

## Objectives

Users manage their own account. Clinic admins manage the clinic profile, branches and (once the backend allows) staff.

## Deliverables

**4a: build now**

- **My account:**
  - profile (read-only: name, email; `PATCH /me` does not exist);
  - change password (`POST /me/password`; explains that other devices are signed out; 5 attempts / 15 min);
  - active sessions list (device from user agent in plain words, last used, "This device" badge) with "Sign out this device" (`DELETE /me/sessions/:id`; revoking the current one signs out) and "Sign out on all devices" (`logout-all`).
- **Clinic profile:** view (`tenant.read`), edit name, time zone, contact email and phone (`tenant.settings.manage`). Read-only pattern for others.
- **Branches:**
  - list with active filter and pagination (`branches.read`);
  - create and edit (`branches.manage`): name, address, city, province, time-zone override, active flag;
  - `409` on a duplicate name → field error.

**4b: waits for backend Phase 4**

- Staff list.
- Invite staff with a role (needs `GET /roles`; integration guide §8 says do not build the form before it exists).
- Resend and revoke invitations.
- Change a member's role, remove a member.
- Edit own profile (D-8). The language preference is added in Phase 14 (D-25).
- Branch assignment.

## Backend endpoints

| Endpoint                                                                                                      | Exists                                 |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `GET /me`, `POST /me/password`, `GET /me/sessions`, `DELETE /me/sessions/{id}`, `POST /auth/logout-all`       | yes                                    |
| `GET/PATCH /tenant`, `GET/POST /branches`, `GET/PATCH /branches/{id}`                                         | yes                                    |
| `POST /invitations`, `POST /invitations/{id}/resend`                                                          | yes, but unusable without `GET /roles` |
| `GET /roles` (D-6), members/invitations list and management (D-7), `PATCH /me` (D-8), branch assignment (D-9) | **no**                                 |

## Tests (outline)

- Component: each form with server validation mapping; read-only versus editable by permission; session revoke confirmation.
- E2E: owner edits the clinic profile and creates/edits a branch; receptionist sees read-only views and gets no edit buttons; change password signs out another browser context; revoking a session from another context.
- Cross-tenant: a branch id from another clinic shows the not-found page.

## Acceptance criteria (draft)

4a complete against the real API. 4b screens not started until D-6/D-7 are in `docs/openapi.json`.

## Open questions

Which time zones to offer (all IANA zones vs. a short list starting with Asia/Manila). The API accepts a string; validation rules to confirm.
