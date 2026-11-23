import { describe, expect, it } from 'vitest';

import type { Member } from '../api/members.ts';
import { memberActions } from './member-actions.ts';

const member = (over: Partial<Member> = {}): Member => ({
  membershipId: 'm1',
  userId: 'u1',
  email: 'ana@example.com',
  fullName: 'Ana Cruz',
  status: 'active',
  jobTitle: null,
  roles: [{ id: 'r1', key: 'doctor', name: 'Doctor' }],
  joinedAt: null,
  ...over,
});
const OWNER_ROLE = { id: 'r0', key: 'owner', name: 'Owner' };

const NOTHING = {
  editRoles: false,
  editJobTitle: false,
  suspend: false,
  reactivate: false,
  remove: false,
};

describe('memberActions (the rules of docs/staff-management-integration.md 4.2, first match wins)', () => {
  it('an active member: edit roles and job title, suspend, remove', () => {
    expect(memberActions({ member: member(), isSelf: false, viewerIsOwner: false })).toEqual({
      ...NOTHING,
      editRoles: true,
      editJobTitle: true,
      suspend: true,
      remove: true,
    });
  });

  it('a suspended member: edit, reactivate, remove (not suspend)', () => {
    expect(
      memberActions({
        member: member({ status: 'suspended' }),
        isSelf: false,
        viewerIsOwner: false,
      }),
    ).toEqual({ ...NOTHING, editRoles: true, editJobTitle: true, reactivate: true, remove: true });
  });

  it('your own row: job title only, and a note that another admin must do the rest', () => {
    expect(memberActions({ member: member(), isSelf: true, viewerIsOwner: true })).toEqual({
      ...NOTHING,
      editJobTitle: true,
      note: 'self',
    });
  });

  it('your own row wins over an owner row and over a removed row', () => {
    expect(
      memberActions({
        member: member({ roles: [OWNER_ROLE] }),
        isSelf: true,
        viewerIsOwner: true,
      }).note,
    ).toBe('self');
    expect(
      memberActions({ member: member({ status: 'removed' }), isSelf: true, viewerIsOwner: false })
        .note,
    ).toBe('self');
  });

  it.each(['removed', 'invited'] as const)(
    'a %s member: nothing, bring them back by inviting',
    (status) => {
      expect(
        memberActions({ member: member({ status }), isSelf: false, viewerIsOwner: true }),
      ).toEqual({ ...NOTHING, note: 'removed' });
    },
  );

  it('a removed owner, seen by a non-owner: still just "removed" (the status rule comes first)', () => {
    expect(
      memberActions({
        member: member({ status: 'removed', roles: [OWNER_ROLE] }),
        isSelf: false,
        viewerIsOwner: false,
      }).note,
    ).toBe('removed');
  });

  it('an owner, seen by someone who is not an owner: job title only, with the owner note', () => {
    expect(
      memberActions({
        member: member({ roles: [OWNER_ROLE] }),
        isSelf: false,
        viewerIsOwner: false,
      }),
    ).toEqual({ ...NOTHING, editJobTitle: true, note: 'owner' });
  });

  it('a suspended owner, seen by a non-owner: the same, no reactivate', () => {
    expect(
      memberActions({
        member: member({ status: 'suspended', roles: [OWNER_ROLE] }),
        isSelf: false,
        viewerIsOwner: false,
      }),
    ).toEqual({ ...NOTHING, editJobTitle: true, note: 'owner' });
  });

  it('an owner, seen by another owner: the full set', () => {
    expect(
      memberActions({
        member: member({ roles: [OWNER_ROLE] }),
        isSelf: false,
        viewerIsOwner: true,
      }),
    ).toMatchObject({ editRoles: true, suspend: true, remove: true });
  });
});
