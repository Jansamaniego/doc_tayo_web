import { describe, expect, it } from 'vitest';

import { can, canAny } from './permissions.ts';

// Menus and buttons follow the permission keys from GET /me, never role names. The server enforces
// them anyway (docs/frontend-integration.md §5).
describe('can', () => {
  const receptionist = ['tenant.read', 'branches.read'] as const;
  const owner = [
    'tenant.read',
    'tenant.settings.manage',
    'branches.read',
    'branches.manage',
    'members.invite',
  ] as const;

  it('is true only for a permission the person holds', () => {
    expect(can(receptionist, 'branches.read')).toBe(true);
    expect(can(receptionist, 'branches.manage')).toBe(false);
    expect(can(owner, 'members.invite')).toBe(true);
  });

  it('treats "no requirement" as allowed', () => {
    expect(can(receptionist, undefined)).toBe(true);
  });

  it('denies everything when there are no permissions (no clinic selected)', () => {
    expect(can([], 'tenant.read')).toBe(false);
  });

  it('never matches on a partial key', () => {
    expect(can(['branches.read'], 'branches')).toBe(false);
    expect(can(['branches.read'], 'branches.read.all')).toBe(false);
  });
});

describe('canAny', () => {
  it('is true if the person holds at least one of the keys', () => {
    expect(canAny(['tenant.read'], ['branches.manage', 'tenant.read'])).toBe(true);
    expect(canAny(['tenant.read'], ['branches.manage', 'members.invite'])).toBe(false);
  });
});
