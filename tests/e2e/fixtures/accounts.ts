// Accounts created by the backend's `npm run db:seed:dev` (docs/frontend-integration.md §2).
// Local and CI use only: these never exist in production.
const password = process.env.E2E_SEED_PASSWORD ?? 'dev-password-change-me-123';

export const accounts = {
  owner: { email: 'owner@sunrise.test', password },
  clinicAdmin: { email: 'clinic-admin@sunrise.test', password },
  receptionist: { email: 'reception@sunrise.test', password },
  // A platform admin: no clinic, reaches only /admin/* (docs/platform-admin-integration.md §1).
  admin: { email: 'admin@doctayo.test', password },
} as const;
