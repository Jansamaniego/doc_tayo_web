/* eslint-disable @typescript-eslint/only-throw-error -- TanStack Router redirects are thrown objects, by design */
import { notFound, redirect } from '@tanstack/react-router';

import { isUsableMembership, sessionStore } from '@/api/session/session-store.ts';

/**
 * Signed-out people go to the sign-in page. Signing in always leads to the home page, never back to
 * the page they were on: an old address could be one this person may not open.
 */
export function requireSignedIn(): void {
  if (sessionStore.get().status === 'signed-in') return;
  throw redirect({ to: '/login' });
}

/** Pages inside the app need a chosen clinic. */
export function requireClinic(): void {
  requireSignedIn();
  const session = sessionStore.get();
  if (session.status === 'signed-in' && session.activeTenantId === null) {
    // A platform admin with no clinic of their own has nothing to pick: Clinics is their home.
    const adminOnly =
      session.platformRole === 'platform_admin' && !session.memberships.some(isUsableMembership);
    throw redirect({ to: adminOnly ? '/admin' : '/select-clinic' });
  }
}

/**
 * The Clinics and Users tabs. Anyone else sees "page not found" (not "no access"), so a clinic user
 * is not told an admin area exists. The server refuses `/admin/*` to them anyway.
 */
export function requirePlatformAdmin(): void {
  requireSignedIn();
  const session = sessionStore.get();
  if (session.status !== 'signed-in' || session.platformRole !== 'platform_admin') throw notFound();
}

/** The sign-in page is for people who are not signed in. */
export function leaveIfSignedIn(): void {
  if (sessionStore.get().status === 'signed-in') throw redirect({ to: '/' });
}
