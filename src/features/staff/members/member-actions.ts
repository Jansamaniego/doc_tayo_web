import type { Member } from '../api/members.ts';

/** Why a row offers less than the full set. */
export type MemberNote = 'self' | 'removed' | 'owner';

export interface MemberActions {
  editRoles: boolean;
  editJobTitle: boolean;
  suspend: boolean;
  reactivate: boolean;
  remove: boolean;
  note?: MemberNote;
}

const NOTHING: MemberActions = {
  editRoles: false,
  editJobTitle: false,
  suspend: false,
  reactivate: false,
  remove: false,
};

/**
 * What the signed-in person may do to this member: the rules of
 * docs/staff-management-integration.md 4.2, first match wins. This only decides what to offer; the
 * server enforces every rule (`SELF_ACTION_FORBIDDEN`, `OWNER_REQUIRED`, `CONFLICT`).
 */
export function memberActions({
  member,
  isSelf,
  viewerIsOwner,
}: {
  member: Member;
  isSelf: boolean;
  viewerIsOwner: boolean;
}): MemberActions {
  if (isSelf) return { ...NOTHING, editJobTitle: true, note: 'self' };
  if (member.status === 'removed' || member.status === 'invited') {
    return { ...NOTHING, note: 'removed' };
  }
  if (!viewerIsOwner && member.roles.some((role) => role.key === 'owner')) {
    return { ...NOTHING, editJobTitle: true, note: 'owner' };
  }
  const edit = { ...NOTHING, editRoles: true, editJobTitle: true, remove: true };
  return member.status === 'active' ? { ...edit, suspend: true } : { ...edit, reactivate: true };
}
