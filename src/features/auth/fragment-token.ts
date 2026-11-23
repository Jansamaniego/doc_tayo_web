/**
 * Reads the emailed token from the URL fragment (`#token=...`) and removes it from the address bar.
 * The fragment is never sent to a server or logged, and removing it keeps the token out of the
 * browser history and out of a screenshot of the address bar (docs/frontend-integration.md §7).
 * It can only be read once: the route reads it and keeps it in memory.
 */
export function readTokenFromFragment(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('token');
  if (token === null || token === '') return null;
  params.delete('token');
  const rest = params.toString();
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ''}`,
  );
  return token;
}

let remembered: string | null = null;

/**
 * The token for the page being shown. Reading the fragment removes it, and the router (or React in
 * development) may ask more than once, so the first answer is kept, in memory only.
 */
export function emailTokenForPage(): string | null {
  const token = readTokenFromFragment();
  if (token !== null) remembered = token;
  return remembered;
}

export function forgetEmailToken(): void {
  remembered = null;
}
