import { useLingui } from '@lingui/react/macro';
import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';

import { useSession } from '@/api/session/session-store.ts';

import { AcceptInvitationForm } from './accept-invitation-form.tsx';
import { AccountSetupForm } from './account-setup-form.tsx';
import { AuthPage } from './AuthPage.tsx';
import { forgetEmailToken } from './fragment-token.ts';
import { ForgotPasswordForm } from './forgot-password-form.tsx';
import { LoginForm, type LoginNotice } from './login-form.tsx';
import { ResetPasswordForm } from './reset-password-form.tsx';
import { SelectClinic } from './select-clinic.tsx';
import { useSessionController } from './session-context.tsx';
import { VerifyEmailForm } from './verify-email-form.tsx';

export function LoginPage({ notice }: { notice: LoginNotice | undefined }) {
  const { t } = useLingui();
  const router = useRouter();
  const session = useSession();
  const sessionNotice = session.status === 'signed-out' ? session.notice : undefined;
  return (
    <AuthPage title={t`Sign in`}>
      <LoginForm
        notice={notice ?? sessionNotice}
        onSignedIn={() => {
          void router.navigate({ to: '/' });
        }}
      />
    </AuthPage>
  );
}

export function ForgotPasswordPage() {
  const { t } = useLingui();
  return (
    <AuthPage title={t`Forgot your password?`}>
      <ForgotPasswordForm />
    </AuthPage>
  );
}

/** For the three pages reached from an emailed link: finish, forget the token, go to sign-in. */
function useFinish(notice: LoginNotice): () => void {
  const router = useRouter();
  return () => {
    forgetEmailToken();
    void router.navigate({ to: '/login', search: { notice: notice as never } });
  };
}

export function ResetPasswordPage({ token }: { token: string | null }) {
  const { t } = useLingui();
  const done = useFinish('password-reset');
  return (
    <AuthPage title={t`Choose a new password`}>
      <ResetPasswordForm token={token} onDone={done} />
    </AuthPage>
  );
}

export function AccountSetupPage({ token }: { token: string | null }) {
  const { t } = useLingui();
  const done = useFinish('account-ready');
  return (
    <AuthPage title={t`Set up your account`}>
      <AccountSetupForm token={token} onDone={done} />
    </AuthPage>
  );
}

export function AcceptInvitationPage({ token }: { token: string | null }) {
  const { t } = useLingui();
  const done = useFinish('invitation-accepted');
  return (
    <AuthPage title={t`Join a clinic`}>
      <AcceptInvitationForm token={token} onDone={done} />
    </AuthPage>
  );
}

export function VerifyEmailPage({ token }: { token: string | null }) {
  const { t } = useLingui();
  const router = useRouter();
  const controller = useSessionController();
  return (
    <AuthPage title={t`Confirm your new email address`}>
      <VerifyEmailForm
        token={token}
        onDone={() => {
          forgetEmailToken();
          // The server ended every session of this person: end this one here too, without asking it.
          void controller
            .endSession('email-changed')
            .then(() => router.navigate({ to: '/login', search: { notice: 'email-changed' } }));
        }}
      />
    </AuthPage>
  );
}

export function SelectClinicPage() {
  const { t } = useLingui();
  const router = useRouter();
  const session = useSession();
  const controller = useSessionController();
  useEffect(() => {
    document.title = t`Choose a clinic`;
  }, [t]);
  if (session.status !== 'signed-in') return null;
  return (
    <AuthPage>
      <SelectClinic
        memberships={session.memberships}
        onSelect={async (tenantId) => {
          await controller.switchClinic(tenantId);
          await router.navigate({ to: '/' });
        }}
        onSignOut={() => {
          void controller.signOut();
        }}
        {...(session.lostClinicName !== undefined && { lostClinicName: session.lostClinicName })}
        showAdminLink={session.platformRole === 'platform_admin'}
      />
    </AuthPage>
  );
}
