import { createFileRoute } from '@tanstack/react-router';

import { MemberDetailPage } from '@/features/staff/members/MemberDetailPage.tsx';

export const Route = createFileRoute('/_app/_clinic/staff/$membershipId')({
  component: function Member() {
    const { membershipId } = Route.useParams();
    const navigate = Route.useNavigate();
    return (
      <MemberDetailPage
        membershipId={membershipId}
        onMissing={() => {
          void navigate({ to: '/staff', search: { notice: 'missing' } });
        }}
      />
    );
  },
});
