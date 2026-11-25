# Authorization

Roles and permissions attach to the **tenant membership**. Permissions are defined in code; roles are tenant-owned.

## Route categories

Every route is exactly one of (enforced by `test/route-registry.e2e-spec.ts`):

| Category                 | Decorator                         | Guards applied                                                                                                                                        |
| ------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public                   | `@Public()`                       | none (health, docs, login, refresh, password recovery, account setup, invitation acceptance); the list is pinned by `test/route-registry.e2e-spec.ts` |
| Authenticated, no tenant | `@TenantNotRequired()`            | `AuthGuard` (`/me*`, `/auth/switch-tenant`, `/auth/logout`)                                                                                           |
| Platform admin           | `@PlatformAdmin()`                | `AuthGuard`, `PlatformAdminGuard` (`/admin/*` only; `users.platform_role = platform_admin`, read with the session on every request)                   |
| Tenant-scoped (default)  | `@RequirePermissions('a.b', ...)` | `AuthGuard`, `TenantGuard`, `PermissionsGuard`                                                                                                        |

A tenant-scoped route **without** `@RequirePermissions` is denied (`403 FORBIDDEN`): deny by default. Every listed permission is required. Global guard order: `ThrottlerGuard` → `AuthGuard` → `PlatformAdminGuard` → `TenantGuard` → `PermissionsGuard` (`TenancyModule`). The registry test also checks that `/admin` routes are exactly the `@PlatformAdmin()` ones and pins their list. The platform role grants **nothing** on tenant routes: a platform admin needs a membership like anyone else. The role is granted only by `npm run admin:grant -- <email>` (no HTTP endpoint).

## Catalog and role templates

Source of truth: `src/modules/access-control/catalog.ts`.

| Permission               | owner | clinic_admin | doctor | nurse | receptionist |
| ------------------------ | ----- | ------------ | ------ | ----- | ------------ |
| `tenant.read`            | yes   | yes          | yes    | yes   | yes          |
| `tenant.settings.manage` | yes   | yes          |        |       |              |
| `branches.read`          | yes   | yes          | yes    | yes   | yes          |
| `branches.manage`        | yes   | yes          |        |       |              |
| `members.read`           | yes   | yes          |        |       |              |
| `members.invite`         | yes   | yes          |        |       |              |
| `members.manage`         | yes   | yes          |        |       |              |
| `patients.read`          | yes   | yes          | yes    | yes   | yes          |
| `patients.manage`        | yes   | yes          | yes    | yes   | yes          |
| `directory.read`         | yes   | yes          | yes    | yes   | yes          |
| `practitioners.manage`   | yes   | yes          |        |       |              |
| `services.read`          | yes   | yes          | yes    | yes   | yes          |
| `services.manage`        | yes   | yes          |        |       |              |
| `appointments.read`      | yes   | yes          | yes    | yes   | yes          |
| `appointments.manage`    | yes   | yes          | yes    | yes   | yes          |
| `encounters.read`        |       |              | yes    | yes   |              |
| `encounters.intake`      |       |              | yes    | yes   |              |
| `encounters.document`    |       |              | yes    |       |              |
| `encounters.sign`        |       |              | yes    |       |              |
| `reference.read`         | yes   | yes          | yes    | yes   | yes          |

Twenty keys: the first seven since Phases 2-4, the other thirteen are the clinical ones added by migration `clinical_permissions` (Phase 5, sub-phase 5.0). **Medical records go to clinical roles only**: owners, clinic admins and receptionists hold no `encounters.*` key, so a non-clinician owner cannot read a consultation. A doctor who also owns the clinic holds both roles (a membership has one to five roles) and keeps full access. A nurse reads records and records intake (complaint, vital signs) but cannot write notes, prescribe or sign. The routes that use them arrive sub-phase by sub-phase: **`patients.read` and `patients.manage` are required by `/patients` since 5.1**; the others are granted but not yet required by any route (5.2 to 5.5). `GET /roles` and `GET /permissions` already list all twenty.

Onboarding materializes the five system roles (`is_system = true`) per tenant from these templates. Custom-role editing is `TODO-LATER L-04`. `test/authorization-matrix.e2e-spec.ts` pins every tenant-scoped route with its permissions and checks it against all five roles with real sign-ins (a new route fails until it is added there).

## How to add a permission (checklist)

1. Add the key to `PERMISSIONS` and `PERMISSION_DESCRIPTIONS` in `catalog.ts`, and to the role templates that should hold it.
2. In a **new migration** (never edit an applied one) insert it and grant it to the system roles of **existing** tenants (`prisma/migrations/*_clinical_permissions/migration.sql` is the worked example for many keys at once: one `VALUES (role, permission)` list, `is_system` only, `ON CONFLICT DO NOTHING`, so custom roles are left alone and running it twice changes nothing):
   ```sql
   INSERT INTO "permissions" ("id", "key", "description")
   VALUES (gen_random_uuid(), 'patients.read', 'View patients')
   ON CONFLICT ("key") DO NOTHING;

   INSERT INTO "role_permissions" ("id", "tenant_id", "role_id", "permission_id")
   SELECT gen_random_uuid(), r."tenant_id", r."id", p."id"
   FROM "roles" r JOIN "permissions" p ON p."key" = 'patients.read'
   WHERE r."is_system" AND r."key" IN ('owner', 'clinic_admin', 'doctor')
   ON CONFLICT DO NOTHING;
   ```
   New tenants get the permission from the code templates at onboarding.
3. Use `@RequirePermissions(PERMISSIONS.PATIENTS_READ)` on the routes.
4. `test/tenancy-schema.e2e-spec.ts` fails if the `permissions` table and the catalog differ; add the role x endpoint cases to the e2e tests.

## Record-level rules (policy pattern)

Route permissions answer "may this role call this endpoint?". Rules about **one record** are pure functions in the module that owns the data (ADR-0014; `@nestjs/authorization` is not used):

- The service loads the facts (inside the transaction when they must not change underneath), calls the policy, and throws `DomainError(code)` when it returns a code. The policy never touches the database, so it is unit-tested with every combination.
- Tenant isolation is **not** a policy concern: the tenant-scoped client makes another clinic's id simply not found (`404`).
- First policy: `src/modules/members/administration/membership.policy.ts` (`getMemberChangeErrorCode`):

| Rule                                                                                                                        | Code                        |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Suspending, removing or changing the roles of your **own** membership (job title is allowed)                                | `403 SELF_ACTION_FORBIDDEN` |
| Not allowed from the current status (suspend: active; reactivate: suspended; remove, roles, job title: active or suspended) | `409 CONFLICT`              |
| Granting or removing `owner`, or changing the status or roles of a member who holds it, by a non-owner                      | `403 OWNER_REQUIRED`        |
| The change would leave no **active** owner                                                                                  | `409 LAST_OWNER`            |

Member changes run in a **serializable** transaction and retry on a serialization failure (up to three attempts, then `409 CONFLICT`). Without it two owners demoting each other at once both succeed and leave none (measured, plans/03 §17a). With the self rule, `LAST_OWNER` can only come from such a race.

## Behaviour to rely on

- Permissions are loaded per request (one query in `TenantGuard`); revoking a permission or removing a membership denies the **next** request. Suspending or removing a member also clears that clinic as the active one on their sessions (they keep their sessions for other clinics).
- Cross-tenant ids answer `404`, missing permission answers `403 FORBIDDEN`.
- Only active users with an active membership in an active tenant pass; a non-member never learns whether a tenant is suspended (`TENANT_ACCESS_DENIED`).
