# Authorization

Roles and permissions attach to the **tenant membership**. Permissions are defined in code; roles are tenant-owned.

## Route categories

Every route is exactly one of (enforced by `test/route-registry.e2e-spec.ts`):

| Category | Decorator | Guards applied |
|---|---|---|
| Public | `@Public()` | none (health, docs, login, refresh, password recovery, account setup, invitation acceptance); the list is pinned by `test/route-registry.e2e-spec.ts` |
| Authenticated, no tenant | `@TenantNotRequired()` | `AuthGuard` (`/me*`, `/auth/switch-tenant`, `/auth/logout`) |
| Tenant-scoped (default) | `@RequirePermissions('a.b', ...)` | `AuthGuard`, `TenantGuard`, `PermissionsGuard` |

A tenant-scoped route **without** `@RequirePermissions` is denied (`403 FORBIDDEN`): deny by default. Every listed permission is required.

## Catalog and role templates

Source of truth: `src/modules/access-control/catalog.ts`.

| Permission | owner | clinic_admin | doctor | nurse | receptionist |
|---|---|---|---|---|---|
| `tenant.read` | yes | yes | yes | yes | yes |
| `tenant.settings.manage` | yes | yes | | | |
| `branches.read` | yes | yes | yes | yes | yes |
| `branches.manage` | yes | yes | | | |
| `members.invite` | yes | yes | | | |

Onboarding materializes the five system roles (`is_system = true`) per tenant from these templates. Custom-role editing is a later phase.

## How to add a permission (checklist)

1. Add the key to `PERMISSIONS` and `PERMISSION_DESCRIPTIONS` in `catalog.ts`, and to the role templates that should hold it.
2. In a **new migration** (never edit an applied one) insert it and grant it to the system roles of **existing** tenants:
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

## Behaviour to rely on

- Permissions are loaded per request (one query in `TenantGuard`); revoking a permission or removing a membership denies the **next** request.
- Cross-tenant ids answer `404`, missing permission answers `403 FORBIDDEN`.
- Only active users with an active membership in an active tenant pass; a non-member never learns whether a tenant is suspended (`TENANT_ACCESS_DENIED`).
