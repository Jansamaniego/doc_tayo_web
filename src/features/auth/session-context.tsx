import { createContext, useContext, type ReactNode } from 'react';

import type { SessionController } from '@/api/session/session.ts';
import { getSession } from '@/api/session/index.ts';

const SessionControllerContext = createContext<SessionController | undefined>(undefined);

/** Lets a test (or a story) give a screen a different controller. The app uses the real one. */
export function SessionControllerProvider({
  controller,
  children,
}: {
  controller: SessionController;
  children: ReactNode;
}) {
  return (
    <SessionControllerContext.Provider value={controller}>
      {children}
    </SessionControllerContext.Provider>
  );
}

export function useSessionController(): SessionController {
  return useContext(SessionControllerContext) ?? getSession();
}
