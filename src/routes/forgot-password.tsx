import { createFileRoute } from '@tanstack/react-router';

import { ForgotPasswordPage } from '@/features/auth/auth-pages.tsx';

export const Route = createFileRoute('/forgot-password')({ component: ForgotPasswordPage });
