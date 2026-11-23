import { createFileRoute } from '@tanstack/react-router';

import { AdminOverviewPage } from '@/features/admin/overview/AdminOverviewPage.tsx';

export const Route = createFileRoute('/_app/admin/')({ component: AdminOverviewPage });
