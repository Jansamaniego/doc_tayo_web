import { describe, expect, it } from 'vitest';

import { clinicActions } from './clinic-status.ts';

describe('clinicActions (what an admin may do from each status)', () => {
  it('lets an active clinic be suspended or deactivated', () => {
    expect(clinicActions('active').map((action) => action.id)).toEqual(['suspend', 'deactivate']);
  });

  it('lets a suspended clinic be reactivated or deactivated', () => {
    expect(clinicActions('suspended').map((action) => action.id)).toEqual([
      'reactivate',
      'deactivate',
    ]);
  });

  it('allows nothing for a deactivated clinic: it is permanent', () => {
    expect(clinicActions('deactivated')).toEqual([]);
  });

  it('sends the status the API expects for each action', () => {
    const all = [...clinicActions('active'), ...clinicActions('suspended')];
    const target = Object.fromEntries(all.map((action) => [action.id, action.target]));
    expect(target).toEqual({
      suspend: 'suspended',
      reactivate: 'active',
      deactivate: 'deactivated',
    });
  });

  it('asks for typed confirmation only to deactivate', () => {
    const all = [...clinicActions('active'), ...clinicActions('suspended')];
    expect(all.filter((action) => action.permanent).map((action) => action.id)).toEqual([
      'deactivate',
      'deactivate',
    ]);
  });
});
