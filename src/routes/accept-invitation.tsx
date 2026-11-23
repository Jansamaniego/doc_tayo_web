import { createFileRoute } from '@tanstack/react-router';

import { AcceptInvitationPage } from '@/features/auth/auth-pages.tsx';
import { emailTokenForPage, forgetEmailToken } from '@/features/auth/fragment-token.ts';

// The emailed token is in the address fragment: read it once, here, and keep it in memory.
export const Route = createFileRoute('/accept-invitation')({
  beforeLoad: () => ({ token: emailTokenForPage() }),
  onLeave: forgetEmailToken,
  component: function Page() {
    return <AcceptInvitationPage token={Route.useRouteContext().token} />;
  },
});
