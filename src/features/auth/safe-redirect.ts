const AUTH_PAGES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/account-setup',
  '/accept-invitation',
];

/**
 * Where to go after signing in. The address comes from the URL (`/login?redirect=...`), so only a
 * path inside this app is accepted: never another site (an open redirect), and never a sign-in page.
 */
export function safeRedirect(value: string | null | undefined): string {
  if (!value) return '/';
  // One leading slash, not "//host" or "/\host" (browsers read both as another site).
  if (!/^\/(?![/\\])/.test(value)) return '/';
  if (/^\/(?:%2f|%5c)/i.test(value)) return '/';
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000-\u001f]/.test(value)) return '/';
  const path = value.split(/[?#]/)[0] ?? '';
  return AUTH_PAGES.includes(path) ? '/' : value;
}
