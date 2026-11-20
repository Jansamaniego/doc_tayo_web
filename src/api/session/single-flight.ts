/**
 * Concurrent callers share one in-flight run. Used for token refresh: two refreshes with the
 * same cookie look like a stolen token to the server and end the session
 * (docs/frontend-integration.md §4). Cross-tab locking is added in Phase 3.
 */
export function createSingleFlight<T>(work: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | undefined;
  return () => {
    inFlight ??= work().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
}
