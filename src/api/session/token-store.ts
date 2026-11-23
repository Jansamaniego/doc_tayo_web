type Listener = () => void;

export interface TokenStore {
  get: () => string | null;
  set: (token: string) => void;
  clear: () => void;
  subscribe: (listener: Listener) => () => void;
}

/**
 * The access token lives in memory only: never in localStorage, sessionStorage or a readable
 * cookie. The refresh token is an httpOnly cookie the app never touches.
 */
export function createTokenStore(): TokenStore {
  let accessToken: string | null = null;
  const listeners = new Set<Listener>();
  const notify = (): void => {
    for (const listener of listeners) listener();
  };
  return {
    get: () => accessToken,
    set: (token) => {
      accessToken = token;
      notify();
    },
    clear: () => {
      accessToken = null;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** This tab's token. */
export const tokenStore = createTokenStore();
