import { createFileRoute } from '@tanstack/react-router';

import { leaveIfSignedIn } from '@/app/guards.ts';
import { LoginPage } from '@/features/auth/auth-pages.tsx';

const NOTICES = [
  'password-reset',
  'account-ready',
  'invitation-accepted',
  'email-changed',
] as const;

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(NOTICES.find((notice) => notice === search.notice) && {
      notice: search.notice as (typeof NOTICES)[number],
    }),
  }),
  beforeLoad: () => {
    leaveIfSignedIn();
  },
  component: function Login() {
    const { notice } = Route.useSearch();
    return <LoginPage notice={notice} />;
  },
});
