/**
 * Menus and buttons follow the permission keys from `GET /me` (`permissions`), never role names.
 * This is for convenience only: the server enforces permissions on every request
 * (docs/frontend-integration.md §5). Current keys: tenant.read, tenant.settings.manage,
 * branches.read, branches.manage, members.invite.
 */
export function can(permissions: readonly string[], required: string | undefined): boolean {
  return required === undefined || permissions.includes(required);
}

export function canAny(permissions: readonly string[], required: readonly string[]): boolean {
  return required.some((key) => permissions.includes(key));
}
