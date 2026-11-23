import { createFileRoute } from '@tanstack/react-router';

import { UserDetailPage } from '@/features/admin/users/UserDetailPage.tsx';

export const Route = createFileRoute('/_app/admin/users/$userId')({
  component: function User() {
    const { userId } = Route.useParams();
    const navigate = Route.useNavigate();
    return (
      <UserDetailPage
        userId={userId}
        onMissing={() => {
          void navigate({ to: '/admin/users' });
        }}
      />
    );
  },
});
