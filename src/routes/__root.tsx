import { createRootRoute } from '@tanstack/react-router';

import { NotFoundPage } from '@/app/NotFoundPage.tsx';
import { RootLayout } from '@/app/RootLayout.tsx';
import { RouteErrorPage } from '@/app/RouteErrorPage.tsx';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: ({ error, reset }) => <RouteErrorPage error={error} reset={reset} />,
});
