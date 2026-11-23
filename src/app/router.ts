import { createRouter, type RouterHistory } from '@tanstack/react-router';

import { routeTree } from '@/routeTree.gen.ts';

/** `history` is only given by tests (an in-memory history). */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, defaultPreload: 'intent', ...(history && { history }) });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
