import { createFileRoute } from '@tanstack/react-router';

import { leaveIfSignedIn } from '@/app/guards.ts';
import { LoginPage } from '@/features/auth/auth-pages.tsx';

const NOTICES = ['password-reset', 'account-ready', 'invitation-accepted'] as const;

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search.redirect === 'string' && { redirect: search.redirect }),
    ...(NOTICES.find((notice) => notice === search.notice) && {
      notice: search.notice as (typeof NOTICES)[number],
    }),
  }),
  beforeLoad: ({ search }) => {
    leaveIfSignedIn(search.redirect);
  },
  component: function Login() {
    const { redirect, notice } = Route.useSearch();
    return <LoginPage redirect={redirect} notice={notice} />;
  },
});
