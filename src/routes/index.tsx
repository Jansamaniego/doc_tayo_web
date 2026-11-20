import { createFileRoute } from '@tanstack/react-router';

import { HomePage } from '@/app/HomePage.tsx';

export const Route = createFileRoute('/')({ component: HomePage });
