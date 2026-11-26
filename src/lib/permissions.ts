/**
 * Menus and buttons follow the permission keys from `GET /me` (`permissions`), never role names.
 * This is for convenience only: the server enforces permissions on every request
 * (docs/frontend-integration.md §5). Current keys (docs/authorization.md): tenant.read,
 * tenant.settings.manage, branches.read, branches.manage, members.read, members.invite,
 * members.manage, patients.read, patients.manage, directory.read, practitioners.manage,
 * services.read, services.manage, appointments.read, appointments.manage, encounters.read,
 * encounters.intake, encounters.document, encounters.sign, reference.read. The encounters.* keys
 * (medical records) are held by doctors and nurses only, never by an admin by default.
 * Routes require directory.read (the directory and reading practitioners), practitioners.manage
 * (changing them), services.read (the services list and pages) and services.manage (changing them)
 * since backend 5.2.
 */
export function can(permissions: readonly string[], required: string | undefined): boolean {
  return required === undefined || permissions.includes(required);
}

export function canAny(permissions: readonly string[], required: readonly string[]): boolean {
  return required.some((key) => permissions.includes(key));
}
