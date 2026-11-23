const MINIMUM_INTERVAL_IN_MILLISECONDS = 60_000;

/**
 * An admin can change someone's roles while their app is open, and nothing tells the app. Asking
 * again when the person comes back to the window picks it up at no cost to anyone who stays put.
 * Returns the function that stops listening.
 */
export function startRefreshOnFocus({
  refreshSession,
  isSignedIn,
}: {
  refreshSession: () => Promise<void>;
  isSignedIn: () => boolean;
}): () => void {
  let lastRefreshAt = Number.NEGATIVE_INFINITY;

  function refreshIfDue(): void {
    if (document.visibilityState === 'hidden' || !isSignedIn()) return;
    const now = Date.now();
    if (now - lastRefreshAt < MINIMUM_INTERVAL_IN_MILLISECONDS) return;
    lastRefreshAt = now;
    void refreshSession();
  }

  window.addEventListener('focus', refreshIfDue);
  document.addEventListener('visibilitychange', refreshIfDue);
  return () => {
    window.removeEventListener('focus', refreshIfDue);
    document.removeEventListener('visibilitychange', refreshIfDue);
  };
}
