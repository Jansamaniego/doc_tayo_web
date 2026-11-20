type Listener = () => void;

let accessToken: string | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * The access token lives in memory only: never in localStorage, sessionStorage or a readable
 * cookie. The refresh token is an httpOnly cookie the app never touches.
 */
export const tokenStore = {
  get: (): string | null => accessToken,
  set(token: string): void {
    accessToken = token;
    notify();
  },
  clear(): void {
    accessToken = null;
    notify();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
