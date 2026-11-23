import { createFileRoute } from '@tanstack/react-router';

import { VerifyEmailPage } from '@/features/auth/auth-pages.tsx';
import { emailTokenForPage, forgetEmailToken } from '@/features/auth/fragment-token.ts';

// A token page like /reset-password: public, and open to a signed-in person too (it is the person
// who asked for the change who opens it). The token is read once from the fragment, into memory.
export const Route = createFileRoute('/verify-email')({
  beforeLoad: () => ({ token: emailTokenForPage() }),
  onLeave: forgetEmailToken,
  component: function Page() {
    return <VerifyEmailPage token={Route.useRouteContext().token} />;
  },
});
