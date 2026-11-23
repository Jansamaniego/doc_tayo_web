import type { TenantStatus } from '../api/admin-tenants.ts';

export type ClinicActionId = 'suspend' | 'reactivate' | 'deactivate';

export interface ClinicAction {
  id: ClinicActionId;
  /** The status sent to the API. */
  target: TenantStatus;
  /** One-way: asks for typed confirmation. */
  permanent: boolean;
}

const SUSPEND: ClinicAction = { id: 'suspend', target: 'suspended', permanent: false };
const REACTIVATE: ClinicAction = { id: 'reactivate', target: 'active', permanent: false };
const DEACTIVATE: ClinicAction = { id: 'deactivate', target: 'deactivated', permanent: true };

/** The status changes the API allows from each status (a disallowed one answers 409). */
export function clinicActions(status: TenantStatus): ClinicAction[] {
  if (status === 'active') return [SUSPEND, DEACTIVATE];
  if (status === 'suspended') return [REACTIVATE, DEACTIVATE];
  return [];
}
