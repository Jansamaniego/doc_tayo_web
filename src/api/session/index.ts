import { getApiClient, setSessionEndedHandler } from '../client.ts';
import { refreshAccessToken } from './refresh.ts';
import { createSessionController, type SessionController } from './session.ts';
import { sessionStore } from './session-store.ts';
import { tokenStore } from './token-store.ts';

let controller: SessionController | undefined;

/** This tab's session controller: boot, sign in and out, switch clinic, and talk to the other tabs. */
export function getSession(): SessionController {
  if (!controller) {
    const created = createSessionController({
      client: getApiClient(),
      refresh: refreshAccessToken,
      tokens: tokenStore,
      store: sessionStore,
    });
    // The API client tells us when the server says the session is over (a refused refresh, or UNAUTHENTICATED).
    setSessionEndedHandler(() => {
      void created.endSession('expired');
    });
    controller = created;
  }
  return controller;
}
