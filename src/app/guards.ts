/* eslint-disable @typescript-eslint/only-throw-error -- TanStack Router redirects are thrown objects, by design */
import { redirect } from '@tanstack/react-router';

import { sessionStore } from '@/api/session/session-store.ts';
import { safeRedirect } from '@/features/auth/safe-redirect.ts';

/** Signed-out people go to the sign-in page, which sends them back here afterwards. */
export function requireSignedIn(location: { href: string }): void {
  if (sessionStore.get().status === 'signed-in') return;
  throw redirect({
    to: '/login',
    search: location.href === '/' ? {} : { redirect: location.href },
  });
}

/** Pages inside the app need a chosen clinic. */
export function requireClinic(location: { href: string }): void {
  requireSignedIn(location);
  const session = sessionStore.get();
  if (session.status === 'signed-in' && session.activeTenantId === null) {
    throw redirect({ to: '/select-clinic' });
  }
}

/** The sign-in page is for people who are not signed in. */
export function leaveIfSignedIn(redirectTo: string | undefined): void {
  if (sessionStore.get().status === 'signed-in') throw redirect({ href: safeRedirect(redirectTo) });
}
